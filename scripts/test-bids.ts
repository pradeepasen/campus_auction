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
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();
const testListingIds: string[] = [];
const testUserIds: string[] = [];
const testUploadUrls: string[] = [];
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

async function setMaximumBidHttp(
  cookie: string,
  listingId: string,
  maxAmount: number | null
): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(`${BASE_URL}/api/auto-bids`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(
      maxAmount === null ? { listingId, remove: true } : { listingId, maxAmount }
    ),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function getUserId(username: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { username },
    select: { id: true },
  });
  return user.id;
}

async function uploadTestImage(
  cookie: string,
  bytes: Uint8Array,
  filename: string,
  mimeType: string
) {
  const formData = new FormData();
  const payload = new Uint8Array(bytes.byteLength);
  payload.set(bytes);
  formData.append("files", new Blob([payload.buffer], { type: mimeType }), filename);
  const response = await fetch(`${BASE_URL}/api/upload`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: formData,
  });
  const body = await response.json().catch(() => ({}));
  if (response.ok && Array.isArray(body.urls)) testUploadUrls.push(...body.urls);
  return { ok: response.ok, status: response.status, body };
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

async function createExtensionTestListing(
  sellerCookie: string,
  closingInMs: number,
  label: string
): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sellerCookie },
    body: JSON.stringify({
      title: `[TEST] ${label} ${Date.now()}`,
      category: "BOOKS",
      condition: "NEW",
      description: "Temporary auction for extension boundary testing.",
      startingPrice: 200,
      minIncrement: 20,
      closingAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      photos: [],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Create extension test listing failed: ${data.error}`);
  const listingId = data.listing.id as string;
  testListingIds.push(listingId);
  await prisma.listing.update({
    where: { id: listingId },
    data: { closingAt: new Date(Date.now() + closingInMs) },
  });
  return listingId;
}

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

  console.log("\n[TEST 0A] Image uploads validate, save, and serve supported images");
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0X8AAAAASUVORK5CYII=",
    "base64"
  );
  const uploadedPng = await uploadTestImage(
    sellerCookie,
    tinyPng,
    "tiny.png",
    "image/png"
  );
  assert(
    uploadedPng.ok && Boolean(uploadedPng.body.urls?.length === 1),
    "A valid PNG upload returns its URL"
  );
  if (uploadedPng.body.urls?.[0]) {
    const imageResponse = await fetch(`${BASE_URL}${uploadedPng.body.urls[0]}`);
    assert(
      imageResponse.ok &&
        Boolean(imageResponse.headers.get("content-type")?.includes("image/png")),
      "The uploaded image URL serves the PNG"
    );
  }
  const mislabeledImage = await uploadTestImage(
    sellerCookie,
    Buffer.from("not an image"),
    "fake.png",
    "image/png"
  );
  assert(
    !mislabeledImage.ok && mislabeledImage.status === 400,
    "An invalid image with a misleading MIME type is rejected"
  );
  const oversizedImage = await uploadTestImage(
    sellerCookie,
    Buffer.alloc(5 * 1024 * 1024 + 1),
    "large.png",
    "image/png"
  );
  assert(!oversizedImage.ok && oversizedImage.status === 400, "Images over 5MB are rejected");

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

  // ── 9. Exact extension boundary and repeat behavior ───────────────────────
  console.log("\n[TEST G] Last-minute extension boundary (20s extends; 45s does not)");
  const atTwentySecondsId = await createExtensionTestListing(
    sellerCookie,
    20_000,
    "20-second extension test"
  );
  const twentySecondBid = await placeBidHttp(bidderCookies[1], atTwentySecondsId, 200);
  const twentySecondListing = await prisma.listing.findUnique({
    where: { id: atTwentySecondsId },
    include: { bids: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  assert(twentySecondBid.ok, "Bid at 20 seconds remaining is accepted");
  assert(twentySecondBid.body.wasExtended === true, "Bid at 20 seconds extends the auction");
  if (twentySecondListing?.bids[0]) {
    const extensionDelta =
      twentySecondListing.closingAt.getTime() - twentySecondListing.bids[0].createdAt.getTime();
    assert(
      extensionDelta >= 59_000 && extensionDelta <= 61_000,
      "20-second bid sets closing time to 60 seconds after the bid",
      `Observed ${extensionDelta}ms`
    );
  }

  console.log("\n[TEST H] 45 seconds remaining does not extend");
  const atFortyFiveSecondsId = await createExtensionTestListing(
    sellerCookie,
    45_000,
    "45-second extension test"
  );
  const beforeFortyFiveBid = await prisma.listing.findUniqueOrThrow({
    where: { id: atFortyFiveSecondsId },
  });
  const fortyFiveSecondBid = await placeBidHttp(
    bidderCookies[0],
    atFortyFiveSecondsId,
    200
  );
  const afterFortyFiveBid = await prisma.listing.findUniqueOrThrow({
    where: { id: atFortyFiveSecondsId },
  });
  assert(fortyFiveSecondBid.ok, "Bid at 45 seconds remaining is accepted");
  assert(fortyFiveSecondBid.body.wasExtended === false, "Bid at 45 seconds does not extend");
  assert(
    afterFortyFiveBid.closingAt.getTime() === beforeFortyFiveBid.closingAt.getTime(),
    "45-second bid leaves the closing time unchanged"
  );

  console.log("\n[TEST I] Repeated bids in the final 30 seconds extend repeatedly");
  const repeatedExtensionId = await createExtensionTestListing(
    sellerCookie,
    20_000,
    "repeated extension test"
  );
  const firstLateBid = await placeBidHttp(bidderCookies[1], repeatedExtensionId, 200);
  const afterFirstLateBid = await prisma.listing.findUniqueOrThrow({
    where: { id: repeatedExtensionId },
  });
  await prisma.listing.update({
    where: { id: repeatedExtensionId },
    data: { closingAt: new Date(Date.now() + 20_000) },
  });
  const secondLateBid = await placeBidHttp(bidderCookies[2], repeatedExtensionId, 220);
  const afterSecondLateBid = await prisma.listing.findUniqueOrThrow({
    where: { id: repeatedExtensionId },
  });
  assert(firstLateBid.ok && firstLateBid.body.wasExtended, "First late bid extends the auction");
  assert(secondLateBid.ok && secondLateBid.body.wasExtended, "Second late bid extends it again");
  assert(afterSecondLateBid.extensionCount === 2, "Repeated late bids increment extension count twice");
  assert(
    afterSecondLateBid.closingAt.getTime() > Date.now() + 55_000,
    "Repeated extension moves closing time to about one minute after the second bid"
  );

  const extensionNotifications = await prisma.notification.findMany({
    where: { listingId: repeatedExtensionId, type: "CLOSING_EXTENDED" },
    select: { userId: true },
  });
  const notifiedUserIds = new Set(extensionNotifications.map((item) => item.userId));
  const testSeller = await prisma.user.findUniqueOrThrow({
    where: { username: seller.username },
    select: { id: true },
  });
  const firstLateBidder = await prisma.user.findUniqueOrThrow({
    where: { username: bidders[1].username },
    select: { id: true },
  });
  const secondLateBidder = await prisma.user.findUniqueOrThrow({
    where: { username: bidders[2].username },
    select: { id: true },
  });
  assert(
    notifiedUserIds.has(testSeller.id) &&
      notifiedUserIds.has(firstLateBidder.id) &&
      notifiedUserIds.has(secondLateBidder.id),
    "Seller and both bidders receive extension notifications"
  );
  assert(
    extensionNotifications.length === 5,
    "Each participant is notified for each of the two extensions"
  );

  const notificationsResponse = await fetch(
    `${BASE_URL}/api/notifications?all=1`,
    { headers: { Cookie: bidderCookies[2] } }
  );
  const notificationsData = await notificationsResponse.json();
  const ownExtensionNotification = notificationsData.notifications.find(
    (notification: { listingId: string; type: string }) =>
      notification.listingId === repeatedExtensionId &&
      notification.type === "CLOSING_EXTENDED"
  );
  assert(
    notificationsResponse.ok && Boolean(ownExtensionNotification),
    "Full notification history includes the bidder's extension alert"
  );
  if (ownExtensionNotification) {
    const markReadResponse = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: bidderCookies[2],
      },
      body: JSON.stringify({ notificationId: ownExtensionNotification.id }),
    });
    assert(markReadResponse.ok, "A notification can be marked read individually");
  }

  // ── 10. Automatic bidding ────────────────────────────────────────────────
  console.log("\n[TEST J] Manual bid below a maximum triggers the correct proxy bid");
  const belowMaximumId = await createExtensionTestListing(
    sellerCookie,
    5 * 60_000,
    "manual below maximum"
  );
  const leaderMaximum = await setMaximumBidHttp(bidderCookies[1], belowMaximumId, 400);
  const challengerBid = await placeBidHttp(bidderCookies[2], belowMaximumId, 220);
  const belowMaximumListing = await prisma.listing.findUniqueOrThrow({
    where: { id: belowMaximumId },
    include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
  });
  assert(leaderMaximum.ok, "A buyer can set a maximum bid");
  assert(challengerBid.ok, "Manual bid below the maximum is accepted");
  assert(
    belowMaximumListing.currentPrice === 240 &&
      belowMaximumListing.bids[0]?.isAutoBid &&
      belowMaximumListing.bids[0]?.amount === 240,
    "Leading bidder automatically responds at manual bid plus increment"
  );

  console.log("\n[TEST K] Manual bid above the leader's maximum takes the lead");
  const aboveMaximumId = await createExtensionTestListing(
    sellerCookie,
    5 * 60_000,
    "manual above maximum"
  );
  const cappedMaximum = await setMaximumBidHttp(bidderCookies[1], aboveMaximumId, 240);
  const overbid = await placeBidHttp(bidderCookies[2], aboveMaximumId, 260);
  const aboveMaximumListing = await prisma.listing.findUniqueOrThrow({
    where: { id: aboveMaximumId },
    include: {
      bids: { orderBy: { amount: "desc" }, take: 1 },
      autoBids: { where: { active: true } },
    },
  });
  const aboveMaximumLeaderId = await getUserId(bidders[2].username);
  const aboveMaximumOutbidId = await getUserId(bidders[1].username);
  assert(cappedMaximum.ok && overbid.ok, "A manual bid above the maximum is accepted");
  assert(
    aboveMaximumListing.bids[0]?.bidderId === aboveMaximumLeaderId &&
      aboveMaximumListing.currentPrice === 260,
    "The manual bidder leads at their submitted amount"
  );
  assert(
    (await prisma.notification.count({
      where: { userId: aboveMaximumOutbidId, listingId: aboveMaximumId, type: "OUTBID" },
    })) > 0,
    "The previous maximum bidder receives an outbid notification"
  );

  console.log("\n[TEST L] Different automatic maxima produce lower maximum plus increment");
  const differentMaximaId = await createExtensionTestListing(
    sellerCookie,
    5 * 60_000,
    "different maximums"
  );
  const lowMaximum = await setMaximumBidHttp(bidderCookies[2], differentMaximaId, 320);
  const highMaximum = await setMaximumBidHttp(bidderCookies[1], differentMaximaId, 400);
  const differentMaximaListing = await prisma.listing.findUniqueOrThrow({
    where: { id: differentMaximaId },
    include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
  });
  const expectedDifferentMaximumLeaderId = await getUserId(bidders[1].username);
  assert(lowMaximum.ok && highMaximum.ok, "Both buyers can register automatic maximums");
  assert(
    differentMaximaListing.bids[0]?.bidderId === expectedDifferentMaximumLeaderId &&
      differentMaximaListing.currentPrice === 340 &&
      differentMaximaListing.bids[0]?.isAutoBid,
    "A later, higher maximum wins at lower maximum plus one increment"
  );

  console.log("\n[TEST M] Equal maximums are awarded to the earlier maximum");
  const equalMaximaId = await createExtensionTestListing(
    sellerCookie,
    5 * 60_000,
    "equal maximums"
  );
  const earlierMaximumBidderId = await getUserId(bidders[2].username);
  const earlierMaximum = await setMaximumBidHttp(bidderCookies[2], equalMaximaId, 300);
  const earlierAutoBid = await prisma.autoBid.findUniqueOrThrow({
    where: { listingId_bidderId: { listingId: equalMaximaId, bidderId: earlierMaximumBidderId } },
  });
  await prisma.autoBid.update({
    where: { id: earlierAutoBid.id },
    data: { createdAt: new Date(Date.now() - 60_000) },
  });
  const laterMaximum = await setMaximumBidHttp(bidderCookies[3], equalMaximaId, 300);
  const equalMaximaListing = await prisma.listing.findUniqueOrThrow({
    where: { id: equalMaximaId },
    include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
  });
  assert(earlierMaximum.ok && laterMaximum.ok, "Both buyers can set equal maximums");
  assert(
    equalMaximaListing.bids[0]?.bidderId === earlierMaximumBidderId &&
      equalMaximaListing.currentPrice === 300,
    "The earlier maximum wins the equal-maximum tie"
  );

  console.log("\n[TEST N] Automatic bids never exceed their buyer's maximum");
  const cappedAutoBidId = await createExtensionTestListing(
    sellerCookie,
    5 * 60_000,
    "automatic bid cap"
  );
  const cappedAutoBidderId = await getUserId(bidders[1].username);
  await setMaximumBidHttp(bidderCookies[1], cappedAutoBidId, 240);
  await placeBidHttp(bidderCookies[2], cappedAutoBidId, 220);
  const cappedAutoBids = await prisma.bid.findMany({
    where: { listingId: cappedAutoBidId, bidderId: cappedAutoBidderId, isAutoBid: true },
  });
  assert(
    cappedAutoBids.length > 0 && cappedAutoBids.every((bid) => bid.amount <= 240),
    "Every automatic bid remains at or below its configured maximum"
  );

  const sellerMaximum = await setMaximumBidHttp(sellerCookie, cappedAutoBidId, 500);
  assert(!sellerMaximum.ok, "The seller cannot set a maximum bid on their own listing");

  console.log("\n[TEST O] Maximum bid validation, raising, and removal");
  const maximumManagementId = await createExtensionTestListing(
    sellerCookie,
    5 * 60_000,
    "maximum management"
  );
  const tooLowMaximum = await setMaximumBidHttp(bidderCookies[0], maximumManagementId, 199);
  const initialMaximum = await setMaximumBidHttp(bidderCookies[0], maximumManagementId, 200);
  const raisedMaximum = await setMaximumBidHttp(bidderCookies[0], maximumManagementId, 300);
  const managedAutoBidderId = await getUserId(bidders[0].username);
  const raisedMaximumRecord = await prisma.autoBid.findUniqueOrThrow({
    where: {
      listingId_bidderId: {
        listingId: maximumManagementId,
        bidderId: managedAutoBidderId,
      },
    },
  });
  const removedMaximum = await setMaximumBidHttp(bidderCookies[0], maximumManagementId, null);
  const activeMaximumCount = await prisma.autoBid.count({
    where: { listingId: maximumManagementId, bidderId: managedAutoBidderId, active: true },
  });
  assert(!tooLowMaximum.ok, "A maximum below the minimum next bid is rejected");
  assert(initialMaximum.ok && raisedMaximum.ok, "A buyer can set and raise their maximum");
  assert(raisedMaximumRecord.maxAmount === 300, "The raised maximum is saved");
  assert(removedMaximum.ok && activeMaximumCount === 0, "A buyer can remove their maximum");

  // ── 12. Filter combination quick check ───────────────────────────────────
  console.log("\n[TEST P] Filter combination sanity (category + price range)");
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
      await Promise.all(
        testUploadUrls.map((url) =>
          fs.unlink(
            path.join(
              process.cwd(),
              "public",
              "uploads",
              path.basename(new URL(url, BASE_URL).pathname)
            )
          )
        )
      );
      console.log("🧹 Temporary bid-test listings and bidder accounts cleaned up.");
    } catch (err) {
      console.error("Test cleanup failed:", err);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
