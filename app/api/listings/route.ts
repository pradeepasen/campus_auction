import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getListings, createListing } from "@/lib/auction-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = (searchParams.get("tab") as "active" | "closed") || "active";
    const category = searchParams.get("category") || undefined;
    const condition = searchParams.get("condition") || undefined;
    const search = searchParams.get("search") || undefined;
    const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
    const closingSoon = (searchParams.get("closingSoon") as "1h" | "24h") || undefined;

    const listings = await getListings({
      tab,
      category,
      condition,
      search,
      minPrice,
      maxPrice,
      closingSoon,
    });

    return NextResponse.json({ listings });
  } catch (err: any) {
    console.error("GET /api/listings error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch listings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "You must be signed in to post an auction." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      title,
      category,
      description,
      condition,
      photos,
      startingPrice,
      minIncrement,
      closingAt,
    } = body;

    const listing = await createListing(userId, {
      title,
      category,
      description,
      condition,
      photos: Array.isArray(photos) ? photos : [],
      startingPrice: Number(startingPrice),
      minIncrement: Number(minIncrement),
      closingAt: new Date(closingAt),
    });

    return NextResponse.json({ success: true, listing }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/listings error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create listing" },
      { status: 400 }
    );
  }
}
