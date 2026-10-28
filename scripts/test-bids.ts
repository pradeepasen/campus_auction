/**
 * npm run test:bids
 *
 * Fires 20 concurrent bids at one active listing, then verifies:
 *  - Exactly one bid wins per price level (no two bids share the same amount)
 *  - The final price equals startingPrice + N * increment (monotonically valid)
 *  - Total bid count equals expected accepted bids (all from different bidders
 *    at valid increments, duplicates rejected cleanly with error messages)
 *  - No seller-bid rule was broken
 *  - Bids after close are rejected
 *  - Tests last-minute extension trigger
 */

import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();
const testListingIds: string[] = [];
const testUserIds: string[] = [];
const runId = crypto.randomBytes(6).toString("hex");

// ── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? `  →  ${detail}` : ""}`);
    failed++;
  }
}

async function registerTestAccount(index: number): Promise<{ username: string; password: string; cookie: string }> {
  const username = `bidtest_${runId}_${index}`;
  const password = "testpass-123";
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Bid Test ${index}`,
      username,
      email: `${username}@campus.test`,
      password,
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(`Registration failed for ${username}: ${d.error || res.status}`);
  }
  const data = await res.json();
  testUserIds.push(data.user.id);
  const raw = res.headers.get("set-cookie") ?? "";
  return { username, password, cookie: raw.split(";")[0] };
}

async function placeBidHttp(
  cookie: string,
  listingId: string,
  amount: number
): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(`${BASE_URL}/api/bids`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ listingId, amount }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

// ── setup: create a fresh test listing that closes in 5 minutes ────────────

async function createTestListing(sellerCookie: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sellerCookie },
    body: JSON.stringify({
      title: `[TEST] Concurrent Bid Stress Test ${Date.now()}`,
      category: "ELECTRONICS",
      condition: "GOOD",
      description: "Automated test listing — safe to ignore.",
      startingPrice: 100,
      minIncrement: 50,
      closingAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      photos: [],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Create listing failed: ${data.error}`);
  testListingIds.push(data.listing.id);
  return data.listing.id;
}

// ── create isolated test bidder accounts ─────────────────────────────────

// ── MAIN TEST SUITE ────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀  CampusBids — Concurrent Bid Stress Test");
  console.log("=".repeat(60));

  // ── 1. Register a temporary seller and create a listing ──────────────────
  console.log("\n[SETUP] Registering a temporary seller and creating test listing…");
  const seller = await registerTestAccount(0);
  const sellerCookie = seller.cookie;
  const listingId = await createTestListing(sellerCookie);
  console.log(`        Listing ID: ${listingId}`);

  // ── 2. Create isolated bidder accounts ────────────────────────────────────
  const bidders = await Promise.all([
    registerTestAccount(1),
    registerTestAccount(2),
    registerTestAccount(3),
    registerTestAccount(4),
    registerTestAccount(5),
  ]);
  const bidderCookies = bidders.map((bidder) => bidder.cookie);
  console.log(`        ${bidderCookies.length} temporary bidder accounts ready.`);

  // ── 3. Invalid credentials must not create sessions or accounts ──────────
  console.log("\n[TEST 0] Invalid login rejection");
  const sellerBeforeInvalidLogin = await prisma.user.findUniqueOrThrow({
    where: { username: seller.username },
    select: { passwordHash: true },
  });
  const badPasswordResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: seller.username, password: "incorrect-password" }),
  });
  const badPasswordBody = await badPasswordResponse.json().catch(() => ({}));
  const sellerAfterInvalidLogin = await prisma.user.findUniqueOrThrow({
    where: { username: seller.username },
    select: { passwordHash: true },
  });
  assert(
    badPasswordResponse.status === 401 &&
      badPasswordBody.error === "Invalid username or password.",
    "Wrong password receives a generic 401"
  );
  assert(
    !badPasswordResponse.headers.get("set-cookie"),
    "Wrong password does not create a session"
  );
  assert(
    sellerAfterInvalidLogin.passwordHash === sellerBeforeInvalidLogin.passwordHash,
    "Wrong password does not change the stored password hash"
  );

  const unknownUsername = `unknown_${runId}`;
  const unknownLoginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: unknownUsername, password: "testpass" }),
  });
  assert(
    unknownLoginResponse.status === 401 &&
      !(await prisma.user.findUnique({ where: { username: unknownUsername } })),
    "Unknown username is rejected without creating an account"
  );

  const duplicateRegistration = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Duplicate",
      username: seller.username,
      email: `duplicate_${runId}@campus.test`,
      password: "testpass-123",
    }),
  });
  assert(duplicateRegistration.status === 409, "Duplicate username is rejected");

  // ── 4. RULE: Seller cannot bid on own listing ────────────────────────────
  console.log("\n[TEST A] Seller self-bid rejection");
  const selfBid = await placeBidHttp(sellerCookie, listingId, 100);
  assert(!selfBid.ok, "Seller bid rejected", selfBid.body.error);
  assert(
    typeof selfBid.body.error === "string" && selfBid.body.error.length > 0,
    "Rejection error message is non-empty"
  );

  // ── 5. RULE: Bid below starting price rejected ───────────────────────────
  console.log("\n[TEST B] Below-starting-price rejection");
  const lowBid = await placeBidHttp(bidderCookies[0], listingId, 50);
  assert(!lowBid.ok, "Bid below starting price rejected", lowBid.body.error);

  // ── 6. 20 CONCURRENT BIDS ────────────────────────────────────────────────
  // Fire 20 bids at the same time. Bids come from 5 bidders cycling through,
  // each requesting amounts that range from starting price upward in increments.
  // Many will race for the same slot — only one wins each slot.
  console.log("\n[TEST C] 20 concurrent bids — atomicity & ordering");
  const startingPrice = 100;
  const minIncrement = 50;

  // Build 20 bid requests spanning 4 valid increment steps + 16 races
  const concurrentBids: Array<{ cookie: string; amount: number }> = [];
  for (let i = 0; i < 20; i++) {
    // cycles through 5 bidder cookies, bids at step i // 4  → many collide
    const bidderIdx = i % bidderCookies.length;
    const step = Math.floor(i / 4); // 0,0,0,0, 1,1,1,1, 2,2,2,2, 3,3,3,3, 4,4,4,4
    const amount = startingPrice + step * minIncrement;
    concurrentBids.push({ cookie: bidderCookies[bidderIdx], amount });
  }

  const results = await Promise.all(
    concurrentBids.map(({ cookie, amount }) =>
      placeBidHttp(cookie, listingId, amount)
    )
  );

  const accepted = results.filter((r) => r.ok);
  const rejected = results.filter((r) => !r.ok);
  const acceptedAmounts = accepted.map((r) => Number(r.body.bid?.amount));

  console.log(
    `        Accepted: ${accepted.length} / Rejected: ${rejected.length}`
  );

  // Every rejection must carry an error message (not a crash)
  const allRejectionsHaveMessages = rejected.every(
    (r) => typeof r.body.error === "string" && r.body.error.trim().length > 0
  );
  assert(
    allRejectionsHaveMessages,
    "Every rejected bid carries a clear error message"
  );

  // At least one bid was accepted
  assert(accepted.length >= 1, "At least one bid was accepted");

  // ── 6. Verify DB bid history ─────────────────────────────────────────────
  console.log("\n[TEST D] Verify DB bid history integrity");
  const listingRow = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      bids: { orderBy: { createdAt: "asc" } },
    },
  });

  assert(listingRow !== null, "Listing still exists in DB");

  const bids = listingRow!.bids;
  console.log(`        DB bid count: ${bids.length}`);

  // Amounts must be strictly monotonically increasing
  let prevAmount = 0;
  let monotonic = true;
  for (const bid of bids) {
    if (bid.amount <= prevAmount) {
      monotonic = false;
      break;
    }
    prevAmount = bid.amount;
  }
  assert(monotonic, "Bid amounts are strictly ascending in DB");

  // No duplicate amounts
  const amounts = bids.map((b) => b.amount);
  const uniqueAmounts = new Set(amounts);
  assert(
    uniqueAmounts.size === amounts.length,
    "No two bids share the same amount",
    amounts.join(", ")
  );

  // Current price equals highest accepted bid
  if (bids.length > 0) {
    const highestDbBid = bids[bids.length - 1];
    assert(
      listingRow!.currentPrice === highestDbBid.amount,
      `Listing.currentPrice (${fmt(listingRow!.currentPrice)}) matches highest bid (${fmt(highestDbBid.amount)})`
    );
    assert(
      bids.length === accepted.length &&
        new Set(accepted.map((r) => r.body.bid?.id)).size === accepted.length &&
        accepted.every((r) => bids.some((bid) => bid.id === r.body.bid?.id)),
      "Every accepted response maps to exactly one stored bid"
    );
    const expectedFinalPrice = acceptedAmounts.length
      ? Math.max(...acceptedAmounts)
      : startingPrice;
    assert(
      listingRow!.currentPrice === expectedFinalPrice,
      `Final price (${fmt(listingRow!.currentPrice)}) matches highest accepted bid (${fmt(expectedFinalPrice)})`
    );
  }

  // Each successive bid is at least startingPrice or prev + increment
  let validIncrements = true;
  for (let i = 0; i < bids.length; i++) {
    const expected =
      i === 0 ? startingPrice : bids[i - 1].amount + minIncrement;
    if (bids[i].amount < expected) {
      validIncrements = false;
      console.error(
        `    Bid ${i}: ₹${bids[i].amount} < expected min ₹${expected}`
      );
    }
  }
  assert(validIncrements, "All DB bids respect starting price / increment rules");

  // ── 7. RULE: Bid after auction closes is rejected ────────────────────────
  // Create a listing that closes in 1 second, wait, then try to bid
  console.log("\n[TEST E] Bid-after-close rejection");
  const closedListingRes = await fetch(`${BASE_URL}/api/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sellerCookie },
    body: JSON.stringify({
      title: `[TEST] Already-closed listing ${Date.now()}`,
      category: "OTHER",
      condition: "FAIR",
      description: "Will close instantly.",
      startingPrice: 100,
      minIncrement: 10,
      closingAt: new Date(Date.now() + 3000).toISOString(), // 3 seconds
      photos: [],
    }),
  });
  const closedListingData = await closedListingRes.json();
  const closedId = closedListingData.listing?.id;

  if (closedId) {
    testListingIds.push(closedId);
    // Wait 4 seconds for it to expire
    console.log("        Waiting 4s for listing to expire…");
    await new Promise((r) => setTimeout(r, 4000));

    // Trigger tick so the server closes it
    await fetch(`${BASE_URL}/api/tick`).catch(() => {});

    const lateBid = await placeBidHttp(bidderCookies[0], closedId, 150);
    assert(!lateBid.ok, "Bid after close rejected", lateBid.body.error);
    assert(
      typeof lateBid.body.error === "string" &&
        lateBid.body.error.toLowerCase().includes("clos"),
      "Rejection message mentions 'closed'"
    );
  } else {
    console.warn("        Skipped: could not create soon-closing listing.");
  }

  // ── 8. RULE: Unauthenticated bid rejected ────────────────────────────────
  console.log("\n[TEST F] Unauthenticated bid rejection (no cookie)");
  const noCookieBid = await placeBidHttp("", listingId, 9999);
  assert(
    !noCookieBid.ok && noCookieBid.status === 401,
    "Unauthenticated bid returns HTTP 401",
    noCookieBid.body.error
  );

  // ── 9. Last-minute extension ─────────────────────────────────────────────
  console.log("\n[TEST G] Last-minute extension (bid within last 30s extends by 60s)");
  const extListingRes = await fetch(`${BASE_URL}/api/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sellerCookie },
    body: JSON.stringify({
      title: `[TEST] Extension test ${Date.now()}`,
      category: "BOOKS",
      condition: "NEW",
      description: "Extension test listing.",
      startingPrice: 200,
      minIncrement: 20,
      closingAt: new Date(Date.now() + 25000).toISOString(), // 25 seconds → within last 30s immediately
      photos: [],
    }),
  });
  const extData = await extListingRes.json();
  const extId = extData.listing?.id;

  if (extId) {
    testListingIds.push(extId);
    const extBid = await placeBidHttp(bidderCookies[1], extId, 200);
    assert(extBid.ok, "Bid placed on near-closing listing accepted");
    if (extBid.ok) {
      assert(
        extBid.body.wasExtended === true,
        "Server confirmed closing time was extended",
        `wasExtended=${extBid.body.wasExtended}`
      );
      // Verify in DB the closingAt was pushed forward
      const extListing = await prisma.listing.findUnique({ where: { id: extId } });
      const newClose = extListing?.closingAt.getTime() ?? 0;
      assert(
        newClose > Date.now() + 30_000,
        `Closing time extended to >${new Date(Date.now() + 30_000).toISOString()}, got ${extListing?.closingAt.toISOString()}`
      );
    }
  } else {
    console.warn("        Skipped: could not create extension-test listing.");
  }

  // ── 10. Filter combination quick check ───────────────────────────────────
  console.log("\n[TEST H] Filter combination sanity (category + price range)");
  const filterRes = await fetch(
    `${BASE_URL}/api/listings?tab=active&category=ELECTRONICS&minPrice=50&maxPrice=9999`,
    { headers: { Cookie: sellerCookie } }
  );
  const filterData = await filterRes.json();
  const filteredListings = filterData.listings ?? [];
  const allElec = filteredListings.every(
    (l: any) => l.category === "ELECTRONICS"
  );
  const allInRange = filteredListings.every(
    (l: any) => l.currentPrice >= 50 && l.currentPrice <= 9999
  );
  assert(filterRes.ok, "Filtered listing request succeeded");
  assert(allElec, "All filtered listings are ELECTRONICS category");
  assert(allInRange, "All filtered listings are within price range");

  // ── summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(
    `📊  Results: ${passed} passed / ${failed} failed`
  );
  if (failed > 0) {
    console.error("❌  Some tests failed. Review the output above.");
    process.exitCode = 1;
  } else {
    console.log("🎉  All tests passed!");
  }
}

main()
  .catch((err) => {
    console.error("FATAL:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (testListingIds.length > 0) {
        await prisma.notification.deleteMany({
          where: { listingId: { in: testListingIds } },
        });
        await prisma.listing.deleteMany({
          where: { id: { in: testListingIds } },
        });
      }
      if (testUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: testUserIds } },
        });
      }
      console.log("🧹 Temporary bid-test listings and bidder accounts cleaned up.");
    } catch (err) {
      console.error("Test cleanup failed:", err);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
