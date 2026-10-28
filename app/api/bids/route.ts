import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { placeBid } from "@/lib/auction-service";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "You must be signed in to place a bid." },
        { status: 401 }
      );
    }

    const { listingId, amount } = await req.json();

    if (!listingId || amount === undefined || isNaN(Number(amount))) {
      return NextResponse.json(
        { error: "Listing ID and a valid bid amount are required." },
        { status: 400 }
      );
    }

    const result = await placeBid(userId, listingId, Number(amount));

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error("Bid error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to place bid" },
      { status: 400 }
    );
  }
}
