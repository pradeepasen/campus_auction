"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Heart, PlusCircle, Trash2, ArrowLeft, AlertCircle, Bell } from "lucide-react";

export default function WantsPage() {
  const [wants, setWants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keywords, setKeywords] = useState("");
  const [category, setCategory] = useState("ALL");
  const [maxPrice, setMaxPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadWants() {
    try {
      const res = await fetch("/api/wants");
      if (res.ok) {
        const data = await res.json();
        setWants(data.wants || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWants();
  }, []);

  async function handleAddWant(e: React.FormEvent) {
    e.preventDefault();
    if (!keywords.trim()) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/wants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: keywords.trim(),
          category: category !== "ALL" ? category : null,
          maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save want");
      setKeywords("");
      setMaxPrice("");
      loadWants();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWant(id: string) {
    try {
      await fetch(`/api/wants?id=${id}`, { method: "DELETE" });
      loadWants();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to auctions
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <Heart className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              My Wants (Wishlist Alerts)
            </h1>
            <p className="text-xs text-slate-500">
              Save what you need. As soon as a senior lists a matching item, you&apos;ll be notified immediately!
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs">{error}</div>
        )}

        <form onSubmit={handleAddWant} className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Keywords (e.g. scientific calculator, cycle, CLRS)..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">Any Category</option>
              <option value="CYCLE">Cycle</option>
              <option value="CALCULATOR">Calculator</option>
              <option value="BOOKS">Books</option>
              <option value="ELECTRONICS">Electronics</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition shadow flex items-center justify-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              {saving ? "Saving..." : "Add Want"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Your Saved Wants</h2>
        {wants.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No saved wants yet. Add keywords above to get alerted when matching items are posted!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {wants.map((w) => (
              <div key={w.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-800">&ldquo;{w.keywords}&rdquo;</div>
                  <div className="text-[11px] text-slate-500">
                    Category: {w.category || "Any"} • Max Price: {w.maxPrice ? `₹${w.maxPrice}` : "No limit"}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteWant(w.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-50 transition"
                  title="Delete want"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
