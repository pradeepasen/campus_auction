import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { confirmHandover } from "@/lib/auction-service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success } = await req.json();
    const updated = await confirmHandover(userId, params.id, Boolean(success));

    return NextResponse.json({ success: true, listing: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Handover confirmation failed" },
      { status: 400 }
    );
  }
}
