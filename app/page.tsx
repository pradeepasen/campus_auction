"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  Clock,
  Sparkles,
  ArrowUpDown,
  Tag,
  RefreshCw,
  PlusCircle,
  AlertCircle,
} from "lucide-react";
import { CountdownTimer } from "@/components/CountdownTimer";
import { StatusBadge } from "@/components/StatusBadge";

interface Listing {
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
  bidCount: number;
  leadingBidder?: { id: string; username: string; name: string } | null;
  seller: { id: string; username: string; name: string; avatar?: string | null };
}

export default function HomePage() {
  const [tab, setTab] = useState<"active" | "closed">("active");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [condition, setCondition] = useState("ALL");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [closingSoon, setClosingSoon] = useState<"" | "1h" | "24h">("");

  const categories = [
    { id: "ALL", label: "All Items" },
    { id: "CYCLE", label: "Cycles 🚲" },
    { id: "CALCULATOR", label: "Calculators 🧮" },
    { id: "BOOKS", label: "Books 📚" },
    { id: "ELECTRONICS", label: "Electronics ⚡" },
    { id: "OTHER", label: "Others 📦" },
  ];

  const conditions = [
    { id: "ALL", label: "All Conditions" },
    { id: "NEW", label: "New / Unopened" },
    { id: "LIKE_NEW", label: "Like New" },
    { id: "GOOD", label: "Good" },
    { id: "FAIR", label: "Fair" },
    { id: "POOR", label: "Poor" },
  ];

  const fetchListings = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams();
      params.set("tab", tab);
      if (category !== "ALL") params.set("category", category);
      if (condition !== "ALL") params.set("condition", condition);
      if (search.trim()) params.set("search", search.trim());
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (closingSoon) params.set("closingSoon", closingSoon);

      const res = await fetch(`/api/listings?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch (err) {
      console.error("Failed to load listings", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, category, condition, search, minPrice, maxPrice, closingSoon]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Live polling every 2 seconds for fresh bids & countdown updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchListings(true);
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchListings]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Campus Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 text-white p-6 sm:p-10 mb-8 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur border border-white/20 text-white mb-3">
            🎓 Last Day of Final Exams • Senior Leaving Market
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Fair campus bidding for leaving seniors&apos; gear.
          </h1>
          <p className="mt-3 text-sm sm:text-base text-blue-100 max-w-xl">
            Cycles, scientific calculators, engineering textbooks, and electronics shouldn&apos;t be lost in spammy chat groups. Every item has its own auction with live countdowns and transparent bidding.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/listings/new"
              className="px-5 py-2.5 rounded-xl bg-white text-blue-700 font-bold text-sm shadow hover:bg-blue-50 transition flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Sell Your Campus Gear
            </Link>
            <Link
              href="/wants"
              className="px-5 py-2.5 rounded-xl bg-blue-800/80 hover:bg-blue-800 text-white font-semibold text-sm border border-blue-400/30 transition"
            >
              Set Wishlist &amp; Get Notified
            </Link>
          </div>
        </div>
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Tabs: Active vs Closed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("active")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
              tab === "active"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>Active Auctions</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                tab === "active" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {tab === "active" ? listings.length : "Live"}
            </span>
          </button>

          <button
            onClick={() => setTab("closed")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
              tab === "closed"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>Past &amp; Closed</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                tab === "closed" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              Outcomes
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Server Live Sync (2s)
          </span>
          {refreshing && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 ml-1" />}
        </div>
      </div>

      {/* Search & Multi-Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-6 space-y-4">
        {/* Keyword Search */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or description (e.g. cycle, Casio, CLRS, Arduino, lamp)..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                category === cat.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Additional Combined Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {/* Condition Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Condition
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {conditions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Min Price */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Min Price (₹)
            </label>
            <input
              type="number"
              placeholder="₹ 0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Max Price */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Max Price (₹)
            </label>
            <input
              type="number"
              placeholder="₹ 5000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Closing Soon Filter */}
          {tab === "active" ? (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Closing Time
              </label>
              <select
                value={closingSoon}
                onChange={(e) => setClosingSoon(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Any time</option>
                <option value="1h">Closing in 1 hour ⚡</option>
                <option value="24h">Closing in 24 hours</option>
              </select>
            </div>
          ) : (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setCategory("ALL");
                  setCondition("ALL");
                  setSearch("");
                  setMinPrice("");
                  setMaxPrice("");
                  setClosingSoon("");
                }}
                className="w-full py-1.5 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 font-medium"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Listings Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 h-80 animate-pulse">
              <div className="w-full h-44 bg-slate-200 rounded-xl mb-4" />
              <div className="w-3/4 h-5 bg-slate-200 rounded mb-2" />
              <div className="w-1/2 h-4 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No auctions match your filters</h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            Try adjusting your search terms or clearing price and category constraints.
          </p>
          <button
            onClick={() => {
              setCategory("ALL");
              setCondition("ALL");
              setSearch("");
              setMinPrice("");
              setMaxPrice("");
              setClosingSoon("");
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((item) => {
            const hasBids = item.bidCount > 0;
            const photoUrl = item.photos[0] || "/placeholder.svg";

            return (
              <Link
                key={item.id}
                href={`/listings/${item.id}`}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col"
              >
                {/* Photo container */}
                <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/90 backdrop-blur shadow-sm text-slate-800">
                      {item.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 text-white backdrop-blur">
                      {item.condition.replace("_", " ")}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    {item.status === "ACTIVE" ? (
                      <CountdownTimer closingAt={item.closingAt} compact />
                    ) : (
                      <StatusBadge status={item.status} outcome={item.outcome} />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1 group-hover:text-blue-600 transition">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  {/* Outcome Label if Closed */}
                  {item.outcome && item.status !== "ACTIVE" && (
                    <div className="mt-3 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                      <span className="font-semibold">Outcome: </span>
                      {item.outcome}
                    </div>
                  )}

                  {/* Price & Leading Bidder */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {hasBids ? "Current Leading Bid" : "Starting Price"}
                      </div>
                      <div className="text-lg font-extrabold text-slate-900 font-mono">
                        ₹{item.currentPrice.toLocaleString("en-IN")}
                      </div>
                    </div>

                    <div className="text-right">
                      {hasBids ? (
                        <div>
                          <div className="text-[10px] text-slate-400">Leading Bidder</div>
                          <div className="text-xs font-bold text-blue-600">
                            @{item.leadingBidder?.username || "bidder"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.bidCount} bid{item.bidCount > 1 ? "s" : ""}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-slate-400">
                          No bids yet
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
