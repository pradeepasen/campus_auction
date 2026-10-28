import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export interface CreateListingInput {
  title: string;
  category: string;
  description: string;
  condition: string;
  photos: string[];
  startingPrice: number;
  minIncrement: number;
  closingAt: Date;
}

export interface EditListingInput {
  title?: string;
  category?: string;
  description?: string;
  condition?: string;
  photos?: string[];
  startingPrice?: number;
  minIncrement?: number;
  closingAt?: Date;
}

// Ensure all expired active auctions are closed based on server time
export async function syncAuctionClosing(listingId?: string) {
  const now = new Date();

  const whereClause: any = {
    status: "ACTIVE",
    closingAt: { lte: now },
  };

  if (listingId) {
    whereClause.id = listingId;
  }

  const expiredListings = await prisma.listing.findMany({
    where: whereClause,
    include: {
      seller: { select: { id: true, username: true } },
      bids: {
        orderBy: { amount: "desc" },
        take: 1,
        include: { bidder: { select: { id: true, username: true } } },
      },
    },
  });

  for (const listing of expiredListings) {
    const highestBid = listing.bids[0];

    if (highestBid) {
      // Auction closed with a provisional winner
      await prisma.$transaction(async (tx) => {
        await tx.listing.update({
          where: { id: listing.id },
          data: {
            status: "PENDING_APPROVAL",
            winnerId: highestBid.bidder.id,
            winningBidId: highestBid.id,
            outcome: `Provisional winner: @${highestBid.bidder.username} at ₹${highestBid.amount}. Awaiting seller approval.`,
          },
        });

        // Notify provisional winner
        await tx.notification.create({
          data: {
            userId: highestBid.bidder.id,
            type: "PROVISIONAL_WINNER",
            title: "Provisional Winner!",
            message: `You are the provisional winner for "${listing.title}" at ₹${highestBid.amount}. Waiting for seller approval.`,
            listingId: listing.id,
            link: `/listings/${listing.id}`,
          },
        });

        // Notify seller to approve or reject
        await tx.notification.create({
          data: {
            userId: listing.sellerId,
            type: "APPROVAL_NEEDED",
            title: "Action Needed: Approve Winning Price",
            message: `Your auction "${listing.title}" closed with a winning bid of ₹${highestBid.amount} from @${highestBid.bidder.username}. Please approve or reject.`,
            listingId: listing.id,
            link: `/listings/${listing.id}`,
          },
        });
        await tx.notification.create({
          data: {
            userId: listing.sellerId,
            type: "AUCTION_CLOSED",
            title: "Auction Closed",
            message: `Your auction "${listing.title}" has closed with a high bid of ₹${highestBid.amount}.`,
            listingId: listing.id,
            link: `/listings/${listing.id}`,
          },
        });
      });
    } else {
      // Closed with no bids
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          status: "CLOSED_UNSOLD",
          outcome: "Closed without any bids.",
        },
      });

      await prisma.notification.create({
        data: {
          userId: listing.sellerId,
          type: "AUCTION_CLOSED",
          title: "Auction Closed (Unsold)",
          message: `Your auction for "${listing.title}" ended with no bids.`,
          listingId: listing.id,
          link: `/listings/${listing.id}`,
        },
      });
    }
  }
}

// Check wants and notify students when matching listing is created or edited
async function checkWantsMatch(listing: {
  id: string;
  title: string;
  description: string;
  category: string;
  startingPrice: number;
  sellerId: string;
}) {
  const activeWants = await prisma.want.findMany({
    where: {
      isActive: true,
      userId: { not: listing.sellerId },
    },
  });

  const titleLower = listing.title.toLowerCase();
  const descLower = listing.description.toLowerCase();
  const categoryLower = listing.category.toLowerCase();

  for (const want of activeWants) {
    const keywords = want.keywords.toLowerCase().split(/\s+/).filter(Boolean);
    const matchesKeyword =
      keywords.length === 0 ||
      keywords.some((kw) => titleLower.includes(kw) || descLower.includes(kw));

    const matchesCategory =
      !want.category || want.category.toLowerCase() === categoryLower;

    const matchesPrice =
      want.maxPrice === null ||
      want.maxPrice === undefined ||
      listing.startingPrice <= want.maxPrice;

    if (matchesKeyword && matchesCategory && matchesPrice) {
      await prisma.notification.create({
        data: {
          userId: want.userId,
          type: "WISHLIST_MATCH",
          title: "Wishlist Match Found!",
          message: `An item matching your want "${want.keywords}" was just posted: "${listing.title}" starting at ₹${listing.startingPrice}.`,
          listingId: listing.id,
          link: `/listings/${listing.id}`,
        },
      });
    }
  }
}

// Create a new listing
export async function createListing(sellerId: string, input: CreateListingInput) {
  const now = new Date();

  // Validate closing time in future
  const closingTime = new Date(input.closingAt);
  if (isNaN(closingTime.getTime()) || closingTime <= now) {
    throw new Error("Closing date and time must be in the future.");
  }

  // Validate price and increment > 0
  if (input.startingPrice <= 0) {
    throw new Error("Starting price must be greater than zero.");
  }
  if (input.minIncrement <= 0) {
    throw new Error("Minimum bid increment must be greater than zero.");
  }

  if (!input.title || input.title.trim().length === 0) {
    throw new Error("Title is required.");
  }

  const validCategories = ["CYCLE", "CALCULATOR", "BOOKS", "ELECTRONICS", "OTHER"];
  const categoryUpper = input.category.toUpperCase();
  if (!validCategories.includes(categoryUpper)) {
    throw new Error("Invalid category.");
  }

  const validConditions = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"];
  const conditionUpper = input.condition.toUpperCase();
  if (!validConditions.includes(conditionUpper)) {
    throw new Error("Invalid condition.");
  }

  const photos = Array.isArray(input.photos) ? input.photos.slice(0, 5) : [];

  const listing = await prisma.listing.create({
    data: {
      sellerId,
      title: input.title.trim(),
      category: categoryUpper,
      description: input.description.trim(),
      condition: conditionUpper,
      photos: JSON.stringify(photos),
      startingPrice: input.startingPrice,
      minIncrement: input.minIncrement,
      currentPrice: input.startingPrice,
      closingAt: closingTime,
      originalClosingAt: closingTime,
      status: "ACTIVE",
    },
  });

  // Check wants and notify interested students
  try {
    await checkWantsMatch({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      startingPrice: listing.startingPrice,
      sellerId,
    });
  } catch (err) {
    console.error("Failed to check wishlist matches:", err);
  }

  return listing;
}

// Edit listing
export async function editListing(
  sellerId: string,
  listingId: string,
  input: EditListingInput
) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { bids: { select: { id: true } } },
  });

  if (!listing) {
    throw new Error("Listing not found.");
  }

  if (listing.sellerId !== sellerId) {
    throw new Error("You are not authorized to edit this listing.");
  }

  if (listing.status !== "ACTIVE") {
    throw new Error(`Cannot edit an auction that is ${listing.status.toLowerCase().replace("_", " ")}.`);
  }

  const hasBids = listing.bids.length > 0;
  const updateData: any = {};

  // Text and photos can always be edited
  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.description !== undefined) updateData.description = input.description.trim();
  if (input.category !== undefined) updateData.category = input.category.toUpperCase();
  if (input.condition !== undefined) updateData.condition = input.condition.toUpperCase();
  if (input.photos !== undefined) {
    updateData.photos = JSON.stringify(input.photos.slice(0, 5));
  }

  // After first bid, starting price, increment and closing time are LOCKED
  if (hasBids) {
    if (
      (input.startingPrice !== undefined && input.startingPrice !== listing.startingPrice) ||
      (input.minIncrement !== undefined && input.minIncrement !== listing.minIncrement) ||
      (input.closingAt !== undefined &&
        new Date(input.closingAt).getTime() !== listing.closingAt.getTime())
    ) {
      throw new Error(
        "Bids have already been placed. Starting price, minimum increment, and closing time are locked."
      );
    }
  } else {
    // If no bids, pricing and closing time can be modified
    if (input.startingPrice !== undefined) {
      if (input.startingPrice <= 0) throw new Error("Starting price must be greater than zero.");
      updateData.startingPrice = input.startingPrice;
      updateData.currentPrice = input.startingPrice;
    }
    if (input.minIncrement !== undefined) {
      if (input.minIncrement <= 0) throw new Error("Minimum bid increment must be greater than zero.");
      updateData.minIncrement = input.minIncrement;
    }
    if (input.closingAt !== undefined) {
      const closingTime = new Date(input.closingAt);
      if (isNaN(closingTime.getTime()) || closingTime <= new Date()) {
        throw new Error("Closing date and time must be in the future.");
      }
      updateData.closingAt = closingTime;
      updateData.originalClosingAt = closingTime;
    }
  }

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: updateData,
  });

  return updated;
}

// Cancel listing
export async function cancelListing(sellerId: string, listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      bids: {
        select: { bidderId: true },
        distinct: ["bidderId"],
      },
    },
  });

  if (!listing) {
    throw new Error("Listing not found.");
  }

  if (listing.sellerId !== sellerId) {
    throw new Error("You are not authorized to cancel this listing.");
  }

  if (listing.status === "CANCELLED" || listing.status === "COMPLETED") {
    throw new Error(`Listing cannot be cancelled because it is already ${listing.status.toLowerCase()}.`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.listing.update({
      where: { id: listingId },
      data: {
        status: "CANCELLED",
        outcome: "Cancelled by seller",
      },
    });

    // Notify all bidders
    for (const bid of listing.bids) {
      await tx.notification.create({
        data: {
          userId: bid.bidderId,
          type: "LISTING_CANCELLED",
          title: "Auction Cancelled",
          message: `The auction for "${listing.title}" was cancelled by the seller. Outcome: Cancelled by seller.`,
          listingId: listing.id,
          link: `/listings/${listing.id}`,
        },
      });
    }

    return cancelled;
  });

  return updated;
}

// Get single listing with public details & check closing
export async function getListingById(id: string) {
  await syncAuctionClosing(id);

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
        },
      },
      winner: {
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
        },
      },
      bids: {
        orderBy: { createdAt: "desc" },
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
            },
          },
        },
      },
      autoBids: {
        where: { active: true },
        orderBy: { maxAmount: "desc" },
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
      },
      questions: {
        orderBy: [{ answerText: "desc" }, { createdAt: "desc" }],
        include: {
          asker: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
            },
          },
        },
      },
    },
  });

  if (!listing) return null;

  let parsedPhotos: string[] = [];
  try {
    parsedPhotos = JSON.parse(listing.photos);
  } catch {
    parsedPhotos = [];
  }

  const leadingBid = listing.bids[0] || null;

  return {
    ...listing,
    photos: parsedPhotos,
    leadingBid,
    leadingBidder: leadingBid?.bidder || null,
    serverTime: new Date().toISOString(),
  };
}

// Get listings with filters
export interface ListingsFilter {
  tab?: "active" | "closed";
  category?: string;
  condition?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  closingSoon?: "1h" | "24h";
}

export async function getListings(filters: ListingsFilter = {}) {
  await syncAuctionClosing();

  const now = new Date();
  const where: any = {};

  if (filters.tab === "closed") {
    where.status = { not: "ACTIVE" };
  } else {
    // Default to active auctions
    where.status = "ACTIVE";
  }

  if (filters.category && filters.category !== "ALL") {
    where.category = filters.category.toUpperCase();
  }

  if (filters.condition && filters.condition !== "ALL") {
    where.condition = filters.condition.toUpperCase();
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
    ];
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.currentPrice = {};
    if (filters.minPrice !== undefined) where.currentPrice.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) where.currentPrice.lte = filters.maxPrice;
  }

  if (filters.closingSoon && where.status === "ACTIVE") {
    const maxTime = new Date(
      now.getTime() + (filters.closingSoon === "1h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
    );
    where.closingAt = {
      gte: now,
      lte: maxTime,
    };
  }

  const listings = await prisma.listing.findMany({
    where,
    orderBy: where.status === "ACTIVE" ? { closingAt: "asc" } : { updatedAt: "desc" },
    include: {
      seller: {
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
        },
      },
      bids: {
        orderBy: { amount: "desc" },
        take: 1,
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: { bids: true },
      },
    },
  });

  return listings.map((item) => {
    let photos: string[] = [];
    try {
      photos = JSON.parse(item.photos);
    } catch {
      photos = [];
    }
    return {
      ...item,
      photos,
      leadingBidder: item.bids[0]?.bidder || null,
      bidCount: item._count.bids,
      serverTime: new Date().toISOString(),
    };
  });
}

async function executeBid(
  tx: Prisma.TransactionClient,
  bidderId: string,
  listingId: string,
  bidAmount: number,
  isAutoBidTrigger = false
) {
  const now = new Date();
  const listing = await tx.listing.findUnique({
    where: { id: listingId },
    include: {
      bids: {
        orderBy: [{ amount: "desc" }, { createdAt: "asc" }],
        take: 1,
        include: { bidder: { select: { id: true, username: true } } },
      },
      autoBids: {
        where: { active: true },
        orderBy: [{ maxAmount: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!listing) throw new Error("Listing not found.");
  if (listing.sellerId === bidderId) {
    throw new Error("A seller cannot bid on their own listing.");
  }
  if (listing.status !== "ACTIVE" || listing.closingAt <= now) {
    throw new Error("Auction has closed. Bids can no longer be accepted.");
  }

  const highestBid = listing.bids[0];
  const minRequired = highestBid
    ? highestBid.amount + listing.minIncrement
    : listing.startingPrice;
  if (!Number.isFinite(bidAmount) || bidAmount < minRequired) {
    throw new Error(`Bid amount must be at least ₹${minRequired.toLocaleString("en-IN")}.`);
  }

  const triggerBid = await tx.bid.create({
    data: { listingId, bidderId, amount: bidAmount, isAutoBid: isAutoBidTrigger },
  });

  const contenders = listing.autoBids.map((autoBid) => ({
    bidderId: autoBid.bidderId,
    maximum: autoBid.bidderId === bidderId
      ? Math.max(autoBid.maxAmount, bidAmount)
      : autoBid.maxAmount,
    createdAt: autoBid.createdAt,
  }));
  if (!contenders.some((contender) => contender.bidderId === bidderId)) {
    contenders.push({ bidderId, maximum: bidAmount, createdAt: now });
  }

  contenders.sort((a, b) => {
    if (a.maximum !== b.maximum) return b.maximum - a.maximum;
    if (!isAutoBidTrigger) {
      if (a.bidderId === bidderId) return -1;
      if (b.bidderId === bidderId) return 1;
    }
    return a.createdAt.getTime() - b.createdAt.getTime() ||
      a.bidderId.localeCompare(b.bidderId);
  });

  const winner = contenders[0];
  const runnerUp = contenders[1];
  const currentLeadAmount = Math.min(
    winner.maximum,
    Math.max(bidAmount, runnerUp ? runnerUp.maximum + listing.minIncrement : bidAmount)
  );
  const currentLeaderId = winner.bidderId;
  let leadingBid = triggerBid;

  if (currentLeadAmount > bidAmount) {
    leadingBid = await tx.bid.create({
      data: {
        listingId,
        bidderId: currentLeaderId,
        amount: currentLeadAmount,
        isAutoBid: true,
      },
    });
  }

  let newClosingAt = listing.closingAt;
  let wasExtended = false;
  const msUntilClosing = listing.closingAt.getTime() - now.getTime();
  if (msUntilClosing > 0 && msUntilClosing <= 30_000) {
    newClosingAt = new Date(now.getTime() + 60_000);
    wasExtended = true;
  }

  await tx.listing.update({
    where: { id: listingId },
    data: {
      currentPrice: currentLeadAmount,
      closingAt: newClosingAt,
      extensionCount: wasExtended ? listing.extensionCount + 1 : listing.extensionCount,
    },
  });

  const outbidUserIds = new Set<string>();
  if (highestBid && highestBid.bidderId !== currentLeaderId) {
    outbidUserIds.add(highestBid.bidderId);
  }
  if (bidderId !== currentLeaderId) outbidUserIds.add(bidderId);
  for (const userId of Array.from(outbidUserIds)) {
    await tx.notification.create({
      data: {
        userId,
        type: "OUTBID",
        title: "You Were Outbid!",
        message: `A higher bid of ₹${currentLeadAmount.toLocaleString("en-IN")} was placed on "${listing.title}".`,
        listingId,
        link: `/listings/${listingId}`,
      },
    });
  }

  if (wasExtended) {
    const [existingBids, activeAutoBids] = await Promise.all([
      tx.bid.findMany({
        where: { listingId },
        select: { bidderId: true },
        distinct: ["bidderId"],
      }),
      tx.autoBid.findMany({
        where: { listingId, active: true },
        select: { bidderId: true },
        distinct: ["bidderId"],
      }),
    ]);
    const participantIds = new Set([
      listing.sellerId,
      ...existingBids.map((bid) => bid.bidderId),
      ...activeAutoBids.map((autoBid) => autoBid.bidderId),
    ]);
    for (const userId of Array.from(participantIds)) {
      await tx.notification.create({
        data: {
          userId,
          type: "CLOSING_EXTENDED",
          title: "Closing Time Extended!",
          message: `Closing time for "${listing.title}" was extended by 1 minute due to a bid in the last 30 seconds.`,
          listingId,
          link: `/listings/${listingId}`,
        },
      });
    }
  }

  await tx.notification.create({
    data: {
      userId: listing.sellerId,
      type: "NEW_BID",
      title: "New Bid Placed!",
      message: `New bid of ₹${currentLeadAmount.toLocaleString("en-IN")} placed on your listing "${listing.title}".`,
      listingId,
      link: `/listings/${listingId}`,
    },
  });

  return {
    bid: leadingBid,
    currentPrice: currentLeadAmount,
    leaderId: currentLeaderId,
    wasExtended,
    newClosingAt,
  };
}

export async function placeBid(bidderId: string, listingId: string, bidAmount: number) {
  return prisma.$transaction((tx) => executeBid(tx, bidderId, listingId, bidAmount));
}

export async function setMaximumBid(
  bidderId: string,
  listingId: string,
  maxAmount: number | null
) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      include: {
        bids: { orderBy: [{ amount: "desc" }, { createdAt: "asc" }], take: 1 },
      },
    });
    if (!listing) throw new Error("Listing not found.");
    if (listing.sellerId === bidderId) {
      throw new Error("The seller cannot set a maximum bid on their own auction.");
    }
    if (listing.status !== "ACTIVE" || listing.closingAt <= now) {
      throw new Error("Auction has closed. Maximum bids can no longer be changed.");
    }

    const highestBid = listing.bids[0];
    const minRequired = highestBid
      ? highestBid.amount + listing.minIncrement
      : listing.startingPrice;

    if (maxAmount === null) {
      await tx.autoBid.updateMany({
        where: { listingId, bidderId, active: true },
        data: { active: false },
      });
      return { removed: true };
    }
    if (!Number.isFinite(maxAmount) || maxAmount < minRequired) {
      throw new Error(
        `Maximum bid must be at least the minimum next bid of ₹${minRequired.toLocaleString("en-IN")}.`
      );
    }

    const existing = await tx.autoBid.findUnique({
      where: { listingId_bidderId: { listingId, bidderId } },
    });
    if (existing) {
      await tx.autoBid.update({
        where: { id: existing.id },
        data: {
          maxAmount,
          active: true,
          ...(!existing.active ? { createdAt: now } : {}),
        },
      });
    } else {
      await tx.autoBid.create({ data: { listingId, bidderId, maxAmount } });
    }

    if (highestBid?.bidderId === bidderId) {
      return { updated: true, currentPrice: highestBid.amount, leaderId: bidderId };
    }

    return {
      updated: true,
      ...(await executeBid(tx, bidderId, listingId, minRequired, true)),
    };
  });
}

// Seller price approval / rejection
export async function setSellerApproval(
  sellerId: string,
  listingId: string,
  approved: boolean
) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      winner: { select: { id: true, username: true } },
    },
  });

  if (!listing) throw new Error("Listing not found.");
  if (listing.sellerId !== sellerId) throw new Error("Unauthorized.");
  if (listing.status !== "PENDING_APPROVAL") {
    throw new Error(`Auction is currently ${listing.status.replace("_", " ")}.`);
  }

  if (approved) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id: listingId },
        data: {
          status: "RESERVED",
          outcome: `Reserved for @${listing.winner?.username || "winner"} at ₹${listing.currentPrice}. Campus handover pending.`,
        },
      });

      const message = `The seller approved your winning bid of ₹${listing.currentPrice} for "${listing.title}". The item is reserved; contact the seller for campus handover.`;
      if (listing.winnerId) {
        await tx.notification.create({
          data: {
            userId: listing.winnerId,
            type: "APPROVED",
            title: "Winning Bid Approved",
            message,
            listingId,
            link: `/listings/${listingId}`,
          },
        });
        await tx.notification.create({
          data: {
            userId: listing.winnerId,
            type: "RESERVED",
            title: "Item Reserved for You",
            message,
            listingId,
            link: `/listings/${listingId}`,
          },
        });
      }
      await tx.notification.create({
        data: {
          userId: sellerId,
          type: "APPROVED",
          title: "Winning Bid Approved",
          message: `You approved the winning bid of ₹${listing.currentPrice} for "${listing.title}".`,
          listingId,
          link: `/listings/${listingId}`,
        },
      });
      await tx.notification.create({
        data: {
          userId: sellerId,
          type: "RESERVED",
          title: "Item Reserved",
          message: `You reserved "${listing.title}" for @${listing.winner?.username || "the winner"}.`,
          listingId,
          link: `/listings/${listingId}`,
        },
      });

      return updated;
    });
  } else {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id: listingId },
        data: {
          status: "REJECTED",
          outcome: `Rejected by seller at ₹${listing.currentPrice}.`,
        },
      });

      const message = `The seller declined the final price of ₹${listing.currentPrice} for "${listing.title}".`;
      if (listing.winnerId) {
        await tx.notification.create({
          data: {
            userId: listing.winnerId,
            type: "REJECTED",
            title: "Winning Price Rejected",
            message,
            listingId,
            link: `/listings/${listingId}`,
          },
        });
      }
      await tx.notification.create({
        data: {
          userId: sellerId,
          type: "REJECTED",
          title: "Winning Price Rejected",
          message: `You rejected the winning price of ₹${listing.currentPrice} for "${listing.title}".`,
          listingId,
          link: `/listings/${listingId}`,
        },
      });

      return updated;
    });
  }
}

// Campus handover confirmation
export async function confirmHandover(
  userId: string,
  listingId: string,
  success: boolean
) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      winner: { select: { id: true, username: true } },
      seller: { select: { id: true, username: true } },
    },
  });

  if (!listing) throw new Error("Listing not found.");
  if (listing.status !== "RESERVED") {
    throw new Error("Handover can only be completed for reserved items.");
  }

  // Either seller or winner can confirm completion; seller can mark pickup failed
  const isSeller = listing.sellerId === userId;
  const isWinner = listing.winnerId === userId;

  if (!isSeller && !isWinner) {
    throw new Error("Only the seller or the winning buyer can confirm handover.");
  }

  if (success) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id: listingId },
        data: {
          status: "COMPLETED",
          outcome: `Campus handover completed. Delivered to @${listing.winner?.username} for ₹${listing.currentPrice}.`,
        },
      });

      const message = `Campus handover for "${listing.title}" is successfully marked as COMPLETED.`;
      const recipients = listing.winnerId
        ? [listing.sellerId, listing.winnerId]
        : [listing.sellerId];
      for (const recipientId of Array.from(new Set(recipients))) {
        await tx.notification.create({
          data: {
            userId: recipientId,
            type: "HANDOVER_COMPLETED",
            title: "Handover Confirmed!",
            message,
            listingId,
            link: `/listings/${listingId}`,
          },
        });
      }

      return updated;
    });
  } else {
    // Only seller can mark pickup failed
    if (!isSeller) {
      throw new Error("Only the seller can mark a handover as failed.");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id: listingId },
        data: {
          status: "PICKUP_FAILED",
          outcome: "Campus pickup failed. Item was not handed over.",
        },
      });

      const message = `Seller marked pickup as failed for "${listing.title}". Outcome: Pickup Failed.`;
      const recipients = listing.winnerId
        ? [listing.sellerId, listing.winnerId]
        : [listing.sellerId];
      for (const recipientId of Array.from(new Set(recipients))) {
        await tx.notification.create({
          data: {
            userId: recipientId,
            type: "HANDOVER_FAILED",
            title: "Campus Pickup Failed",
            message,
            listingId,
            link: `/listings/${listingId}`,
          },
        });
      }

      return updated;
    });
  }
}
