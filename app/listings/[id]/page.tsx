"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  Gavel,
  ShieldAlert,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  History,
  ArrowLeft,
  User,
  Zap,
  HelpCircle,
} from "lucide-react";
import { CountdownTimer } from "@/components/CountdownTimer";
import { StatusBadge } from "@/components/StatusBadge";

interface BidItem {
  id: string;
  amount: number;
  isAutoBid: boolean;
  createdAt: string;
  bidder: {
    id: string;
    username: string;
    name: string;
    avatar?: string | null;
  };
}

interface ListingDetail {
  id: string;
  title: string;
  category: string;
  condition: string;
  description: string;
  photos: string[];
  startingPrice: number;
  minIncrement: number;
  currentPrice: number;
  closingAt: string;
  status: string;
  outcome?: string | null;
  sellerId: string;
  winnerId?: string | null;
  extensionCount: number;
  seller: { id: string; username: string; name: string; avatar?: string | null };
  winner?: { id: string; username: string; name: string } | null;
  leadingBid?: BidItem | null;
  leadingBidder?: { id: string; username: string; name: string } | null;
  bids: BidItem[];
  autoBids: Array<{
    id: string;
    maxAmount: number;
    bidder: { id: string; username: string; name: string };
  }>;
}

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string>("");

  // Action states
  const [bidAmount, setBidAmount] = useState<string>("");
  const [biddingLoading, setBiddingLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Fetch listing data
  const loadListing = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`/api/listings/${listingId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/");
          return;
        }
      }
      const data = await res.json();
      if (data.listing) {
        setListing(data.listing);
        if (!selectedPhoto && data.listing.photos.length > 0) {
          setSelectedPhoto(data.listing.photos[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load listing", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [listingId, router, selectedPhoto]);

  // Fetch current user
  async function loadUser() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setCurrentUser(data.user || null);
    } catch {
      setCurrentUser(null);
    }
  }

  useEffect(() => {
    loadListing();
    loadUser();
  }, [loadListing]);

  // Live polling every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadListing(true);
    }, 2000);
    return () => clearInterval(interval);
  }, [loadListing]);

  // Calculate minimum valid bid
  const hasBids = (listing?.bids.length || 0) > 0;
  const minValidBid = listing
    ? hasBids
      ? listing.currentPrice + listing.minIncrement
      : listing.startingPrice
    : 0;

  // Set default bid amount when listing loads
  useEffect(() => {
    if (listing && !bidAmount) {
      setBidAmount(minValidBid.toString());
    }
  }, [listing, minValidBid, bidAmount]);

  // Handle manual bid submission
  async function handlePlaceBid(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");

    if (!currentUser) {
      router.push("/login");
      return;
    }

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount < minValidBid) {
      setActionError(`Bid must be at least ₹${minValidBid.toLocaleString("en-IN")}`);
      return;
    }

    setBiddingLoading(true);

    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          amount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to place bid");
      }

      setActionSuccess(`Bid of ₹${amount.toLocaleString("en-IN")} placed successfully!`);
      loadListing(true);
    } catch (err: any) {
      setActionError(err.message || "Failed to place bid");
    } finally {
      setBiddingLoading(false);
    }
  }

  // Handle listing cancellation by seller
  async function handleCancelListing() {
    setActionError("");
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel listing");
      }
      setShowCancelModal(false);
      loadListing(true);
    } catch (err: any) {
      setActionError(err.message || "Failed to cancel");
    }
  }

  // Handle seller approval or rejection of price
  async function handleApproval(approved: boolean) {
    setActionError("");
    try {
      const res = await fetch(`/api/listings/${listingId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update approval");
      loadListing(true);
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  // Handle handover confirmation
  async function handleHandover(success: boolean) {
    setActionError("");
    try {
      const res = await fetch(`/api/listings/${listingId}/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update handover");
      loadListing(true);
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  if (loading || !listing) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs text-slate-500">Loading auction details...</p>
      </div>
    );
  }

  const isSeller = currentUser?.id === listing.sellerId;
  const isWinner = currentUser?.id === listing.winnerId;
  const isLeading = currentUser?.id === listing.leadingBidder?.id;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all auctions
        </Link>

        <div className="flex items-center gap-2">
          {listing.status === "ACTIVE" ? (
            <CountdownTimer closingAt={listing.closingAt} />
          ) : (
            <StatusBadge status={listing.status} outcome={listing.outcome} />
          )}
        </div>
      </div>

      {/* Outcome / Status Alert Banner */}
      {listing.outcome && (
        <div
          className={`mb-6 p-4 rounded-2xl border text-sm flex items-start gap-3 shadow-sm ${
            listing.status === "COMPLETED"
              ? "bg-purple-50 border-purple-200 text-purple-900"
              : listing.status === "CANCELLED"
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : listing.status === "RESERVED"
              ? "bg-blue-50 border-blue-200 text-blue-900"
              : listing.status === "PENDING_APPROVAL"
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : listing.status === "REJECTED" || listing.status === "PICKUP_FAILED"
              ? "bg-orange-50 border-orange-200 text-orange-900"
              : "bg-slate-50 border-slate-200 text-slate-800"
          }`}
        >
          <div className="mt-0.5">
            {listing.status === "COMPLETED" && <CheckCircle className="w-5 h-5 text-purple-600" />}
            {listing.status === "CANCELLED" && <XCircle className="w-5 h-5 text-rose-600" />}
            {listing.status === "PENDING_APPROVAL" && <Clock className="w-5 h-5 text-amber-600" />}
            {listing.status === "RESERVED" && <CheckCircle className="w-5 h-5 text-blue-600" />}
          </div>
          <div>
            <div className="font-bold">Auction Outcome</div>
            <div className="text-xs mt-0.5">{listing.outcome}</div>
          </div>
        </div>
      )}

      {/* Extension Notice */}
      {listing.extensionCount > 0 && (
        <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600" />
          <span>
            <strong>Closing time extended!</strong> Late bids in the final 30s triggered an anti-sniping extension (extended {listing.extensionCount} time{listing.extensionCount > 1 ? "s" : ""}).
          </span>
        </div>
      )}

      {/* Main Grid: Left Gallery & Details, Right Bidding & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Photos & Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Photo */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm aspect-[16/11] relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto || listing.photos[0] || "/placeholder.svg"}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/95 text-slate-800 shadow">
                {listing.category}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/70 text-white backdrop-blur">
                {listing.condition.replace("_", " ")}
              </span>
            </div>
          </div>

          {/* Thumbnails */}
          {listing.photos.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {listing.photos.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPhoto(p)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                    selectedPhoto === p ? "border-blue-600 scale-95" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="Thumbnail" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Description & Item Specs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
              {listing.title}
            </h1>

            <div className="flex items-center gap-2 text-xs text-slate-500 mb-6 pb-4 border-b border-slate-100">
              <span>Listed by </span>
              <span className="font-bold text-blue-600">@{listing.seller.username}</span>
              <span>({listing.seller.name})</span>
              <span>•</span>
              <span>Senior Leaving Auction</span>
            </div>

            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Item Description
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            </div>

            {/* Auction Rules Summary */}
            <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-400 block mb-0.5">Starting Price</span>
                <span className="font-bold text-slate-800 font-mono">
                  ₹{listing.startingPrice.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-400 block mb-0.5">Min Increment</span>
                <span className="font-bold text-slate-800 font-mono">
                  ₹{listing.minIncrement.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-400 block mb-0.5">Total Bids</span>
                <span className="font-bold text-slate-800 font-mono">
                  {listing.bids.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Live Bidding, Actions, History */}
        <div className="lg:col-span-5 space-y-6">
          {/* Price & Bidding Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-medium text-slate-400">
                  {hasBids ? "Current Leading Bid" : "Starting Price"}
                </span>
                <div className="text-3xl font-extrabold text-slate-900 font-mono">
                  ₹{listing.currentPrice.toLocaleString("en-IN")}
                </div>
              </div>

              {hasBids && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Leading Bidder</span>
                  <span className="text-sm font-bold text-blue-600">
                    @{listing.leadingBidder?.username}
                  </span>
                  {isLeading && (
                    <span className="block text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-0.5">
                      You are in the lead!
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Error or Success feedback */}
            {actionError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {actionSuccess}
              </div>
            )}

            {/* Bidding Section for Buyers */}
            {listing.status === "ACTIVE" ? (
              isSeller ? (
                /* Seller cannot bid on own listing */
                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <ShieldAlert className="w-5 h-5 text-amber-500 mb-2" />
                  <strong>You are the seller of this auction.</strong> Sellers cannot bid on their own items.
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 text-xs flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit Listing
                    </Link>
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 font-semibold text-red-700 hover:bg-red-100 text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Cancel Auction
                    </button>
                  </div>
                </div>
              ) : (
                /* Buyer Bidding Form */
                <form onSubmit={handlePlaceBid} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Your Bid Amount (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={minValidBid}
                        step="1"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={`Min ₹${minValidBid}`}
                        required
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-base font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>Minimum required: ₹{minValidBid.toLocaleString("en-IN")}</span>
                      <span>Increment: +₹{listing.minIncrement}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={biddingLoading}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
                  >
                    <Gavel className="w-4 h-4" />
                    {biddingLoading ? "Submitting Bid..." : `Place Bid (₹${Number(bidAmount || minValidBid).toLocaleString("en-IN")})`}
                  </button>

                  <p className="text-[10px] text-slate-400 text-center">
                    All bids are final and recorded in public history. Server clock time is strictly enforced.
                  </p>
                </form>
              )
            ) : (
              /* Post-Closing Workflow Actions (Approval & Handover) */
              <div className="mt-4 space-y-3">
                {listing.status === "PENDING_APPROVAL" && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="font-bold text-xs text-amber-900 mb-1">
                      Awaiting Seller Decision
                    </div>
                    <p className="text-xs text-amber-800">
                      Provisional winner is <strong>@{listing.winner?.username}</strong> at{" "}
                      <strong>₹{listing.currentPrice.toLocaleString("en-IN")}</strong>.
                    </p>

                    {isSeller && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleApproval(true)}
                          className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve Price
                        </button>
                        <button
                          onClick={() => handleApproval(false)}
                          className="flex-1 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject Price
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {listing.status === "RESERVED" && (
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <div className="font-bold text-xs text-blue-900 mb-1">
                      🤝 Item Reserved for Campus Handover
                    </div>
                    <p className="text-xs text-blue-800 mb-3">
                      Meet at hostel/campus block to inspect and exchange. Once handed over, confirm below.
                    </p>

                    {(isSeller || isWinner) && (
                      <div className="space-y-2">
                        <button
                          onClick={() => handleHandover(true)}
                          className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Confirm Campus Handover Completed
                        </button>

                        {isSeller && (
                          <button
                            onClick={() => handleHandover(false)}
                            className="w-full py-1.5 px-3 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold text-xs transition"
                          >
                            Mark Pickup Failed (No show)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Full Public Bid History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-900 text-sm">Full Public Bid History</h3>
              </div>
              <span className="text-xs font-mono text-slate-500 font-semibold">
                {listing.bids.length} bid{listing.bids.length !== 1 ? "s" : ""}
              </span>
            </div>

            {listing.bids.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No bids placed yet. Be the first to bid!
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {listing.bids.map((bid, index) => {
                  const isFirst = index === 0;
                  return (
                    <div
                      key={bid.id}
                      className={`py-2.5 px-2 flex items-center justify-between text-xs transition ${
                        isFirst ? "bg-blue-50/60 rounded-lg font-semibold" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                          {bid.bidder.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-900 font-bold">
                              @{bid.bidder.username}
                            </span>
                            {isFirst && (
                              <span className="text-[9px] uppercase px-1.5 py-0.2 bg-blue-600 text-white font-bold rounded">
                                Leading
                              </span>
                            )}
                            {bid.isAutoBid && (
                              <span className="text-[9px] uppercase px-1.5 py-0.2 bg-purple-100 text-purple-700 font-bold rounded">
                                Auto-Bid
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(bid.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-900 text-sm">
                          ₹{bid.amount.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Cancel this auction?</h3>
            <p className="text-xs text-slate-600 mt-2">
              Cancelling will close the auction immediately with the public outcome{" "}
              <strong>&ldquo;Cancelled by seller&rdquo;</strong> and notify all bidders. This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold hover:bg-slate-50 transition"
              >
                Keep Auction Active
              </button>
              <button
                onClick={handleCancelListing}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition shadow"
              >
                Yes, Cancel Auction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
