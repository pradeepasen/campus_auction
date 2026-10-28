import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
  } catch (err: any) {
    console.error("Error in GET /api/auth/me:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
