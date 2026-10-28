import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { setSellerApproval } from "@/lib/auction-service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { approved } = await req.json();
    const updated = await setSellerApproval(userId, params.id, Boolean(approved));

    return NextResponse.json({ success: true, listing: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Approval failed" },
      { status: 400 }
    );
  }
}
