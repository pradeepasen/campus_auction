import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { setMaximumBid } from "@/lib/auction-service";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "You must be signed in to set a maximum bid." },
        { status: 401 }
      );
    }

    const body = await req.json();
    if (typeof body.listingId !== "string" || !body.listingId) {
      return NextResponse.json({ error: "A listing ID is required." }, { status: 400 });
    }

    if (body.remove === true) {
      const result = await setMaximumBid(userId, body.listingId, null);
      return NextResponse.json({ success: true, ...result });
    }

    const maxAmount = Number(body.maxAmount);
    if (!Number.isFinite(maxAmount)) {
      return NextResponse.json(
        { error: "A valid maximum bid amount is required." },
        { status: 400 }
      );
    }

    const result = await setMaximumBid(userId, body.listingId, maxAmount);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update maximum bid.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
