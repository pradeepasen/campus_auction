import { NextResponse } from "next/server";
import { syncAuctionClosing } from "@/lib/auction-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await syncAuctionClosing();
    return NextResponse.json({
      success: true,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
