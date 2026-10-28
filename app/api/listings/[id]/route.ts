import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getListingById, editListing, cancelListing } from "@/lib/auction-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listing = await getListingById(params.id);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    return NextResponse.json({ listing });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch listing" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const updated = await editListing(userId, params.id, {
      title: body.title,
      category: body.category,
      description: body.description,
      condition: body.condition,
      photos: body.photos,
      startingPrice: body.startingPrice !== undefined ? Number(body.startingPrice) : undefined,
      minIncrement: body.minIncrement !== undefined ? Number(body.minIncrement) : undefined,
      closingAt: body.closingAt ? new Date(body.closingAt) : undefined,
    });

    return NextResponse.json({ success: true, listing: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update listing" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cancelled = await cancelListing(userId, params.id);
    return NextResponse.json({ success: true, listing: cancelled });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to cancel listing" },
      { status: 400 }
    );
  }
}
