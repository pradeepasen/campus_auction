"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, AlertCircle, Lock, Upload, X, Trash2 } from "lucide-react";

export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hasBids, setHasBids] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("CYCLE");
  const [condition, setCondition] = useState("GOOD");
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [minIncrement, setMinIncrement] = useState("");
  const [closingAt, setClosingAt] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function fetchListing() {
      try {
        const res = await fetch(`/api/listings/${listingId}`);
        if (!res.ok) throw new Error("Failed to load listing");
        const data = await res.json();
        const item = data.listing;

        setTitle(item.title);
        setCategory(item.category);
        setCondition(item.condition);
        setDescription(item.description);
        setStartingPrice(item.startingPrice.toString());
        setMinIncrement(item.minIncrement.toString());
        setPhotos(item.photos || []);

        const closingDate = new Date(item.closingAt);
        const tzOffset = closingDate.getTimezoneOffset() * 60000;
        const localISO = new Date(closingDate.getTime() - tzOffset).toISOString().slice(0, 16);
        setClosingAt(localISO);

        setHasBids(item.bids && item.bids.length > 0);
      } catch (err: any) {
        setError(err.message || "Failed to load listing");
      } finally {
        setLoading(false);
      }
    }

    fetchListing();
  }, [listingId]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 5) {
      setError("Maximum 5 photos allowed per listing.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPhotos((prev) => [...prev, ...data.urls]);
    } catch (err: any) {
      setError(err.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload: any = {
        title,
        category,
        condition,
        description,
        photos,
      };

      if (!hasBids) {
        payload.startingPrice = parseFloat(startingPrice);
        payload.minIncrement = parseFloat(minIncrement);
        payload.closingAt = new Date(closingAt).toISOString();
      }

      const res = await fetch(`/api/listings/${listingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update listing");
      }

      router.push(`/listings/${listingId}`);
    } catch (err: any) {
      setError(err.message || "Failed to update listing");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-xs text-slate-500">
        Loading listing for editing...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href={`/listings/${listingId}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to item
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="border-b border-slate-100 pb-5 mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Edit Campus Auction Listing
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Update description, photos, or specs for your item.
          </p>
        </div>

        {hasBids && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Bidding has already started!</strong> Starting price, minimum increment, and closing time are locked to maintain auction fairness. You can still freely edit title, description, category, condition, and photos.
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Item Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category & Condition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="CYCLE">Cycle 🚲</option>
                <option value="CALCULATOR">Calculator 🧮</option>
                <option value="BOOKS">Books 📚</option>
                <option value="ELECTRONICS">Electronics ⚡</option>
                <option value="OTHER">Other Campus Item 📦</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Condition <span className="text-red-500">*</span>
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="NEW">New (Unopened / Mint)</option>
                <option value="LIKE_NEW">Like New</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Photos (Up to 5)
            </label>
            <div className="space-y-3">
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {photos.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative w-24 h-24 rounded-xl border border-slate-200 overflow-hidden bg-slate-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Item photo" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-90 hover:opacity-100 transition shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photos.length < 5 && (
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 text-slate-600 hover:text-blue-600 text-xs font-semibold transition bg-slate-50">
                  <Upload className="w-4 h-4" />
                  <span>{uploading ? "Uploading..." : "Add More Photos"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Pricing & Increment (Locked if has bids) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Starting Price (₹)
                {hasBids && <Lock className="w-3 h-3 text-amber-500" />}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  value={startingPrice}
                  disabled={hasBids}
                  onChange={(e) => setStartingPrice(e.target.value)}
                  className={`w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono ${
                    hasBids ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "focus:outline-none focus:ring-2 focus:ring-blue-500"
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Minimum Increment (₹)
                {hasBids && <Lock className="w-3 h-3 text-amber-500" />}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  value={minIncrement}
                  disabled={hasBids}
                  onChange={(e) => setMinIncrement(e.target.value)}
                  className={`w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono ${
                    hasBids ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "focus:outline-none focus:ring-2 focus:ring-blue-500"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Closing Time (Locked if has bids) */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Auction Closing Date &amp; Time
              {hasBids && <Lock className="w-3 h-3 text-amber-500" />}
            </label>
            <input
              type="datetime-local"
              value={closingAt}
              disabled={hasBids}
              onChange={(e) => setClosingAt(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono ${
                hasBids ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "focus:outline-none focus:ring-2 focus:ring-blue-500"
              }`}
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Link
              href={`/listings/${listingId}`}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition shadow disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {submitting ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
