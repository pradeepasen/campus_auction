"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Upload, X, AlertCircle, ArrowLeft, Image as ImageIcon } from "lucide-react";
import Link from "next/link";

export default function CreateListingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("CYCLE");
  const [condition, setCondition] = useState("GOOD");
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [minIncrement, setMinIncrement] = useState("50");
  const [photos, setPhotos] = useState<string[]>([]);

  // Default closing time: 24 hours from right now
  const defaultClosing = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tzOffset = defaultClosing.getTimezoneOffset() * 60000;
  const localISOTime = new Date(defaultClosing.getTime() - tzOffset).toISOString().slice(0, 16);
  const [closingAt, setClosingAt] = useState(localISOTime);

  // File upload handler
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.currentTarget.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (photos.length + files.length > 5) {
      setError("Maximum 5 photos allowed per listing.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (HTTP ${res.status}).`);
      }

      if (!Array.isArray(data.urls) || data.urls.length !== files.length) {
        throw new Error("The server did not confirm every image upload. Please try again.");
      }
      setPhotos((prev) => [...prev, ...data.urls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  // Quick preset photos for easy testing without local image files
  function addPresetPhoto(type: string) {
    if (photos.length >= 5) {
      setError("Maximum 5 photos allowed.");
      return;
    }
    const presetMap: Record<string, string> = {
      CYCLE: "/uploads/cycle-hercules-roadeo-21-speed-cycle.svg",
      CALCULATOR: "/uploads/calculator-casio-fx-991ex-classwiz-scientific-calculator.svg",
      BOOKS: "/uploads/books-clrs--introduction-to-algorithms--4th-edition-.svg",
      ELECTRONICS: "/uploads/electronics-raspberry-pi-4-model-b--4gb-ram----case---adapter.svg",
      OTHER: "/uploads/other-adjustable-campus-desk-study-lamp--3-color-modes-.svg",
    };
    const url = presetMap[type] || presetMap.OTHER;
    setPhotos((prev) => [...prev, url]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const price = parseFloat(startingPrice);
    const inc = parseFloat(minIncrement);
    const closingDate = new Date(closingAt);

    if (isNaN(price) || price <= 0) {
      setError("Starting price must be a valid number greater than ₹0.");
      return;
    }

    if (isNaN(inc) || inc <= 0) {
      setError("Minimum bid increment must be greater than ₹0.");
      return;
    }

    if (isNaN(closingDate.getTime()) || closingDate <= new Date()) {
      setError("Closing date and time must be set in the future.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          condition,
          description,
          startingPrice: price,
          minIncrement: inc,
          closingAt: closingDate.toISOString(),
          photos,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create listing.");
      }

      router.push(`/listings/${data.listing.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create listing.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to all auctions
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="border-b border-slate-100 pb-5 mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Post an Item for Campus Auction
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Leaving campus? List your cycle, calculator, books, or electronics. Every item closes fairly at its own specified time.
          </p>
        </div>

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
              placeholder="e.g. Hercules Roadeo 21-Speed Cycle with Lock"
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
                <option value="LIKE_NEW">Like New (Barely used)</option>
                <option value="GOOD">Good (Fully functional, normal wear)</option>
                <option value="FAIR">Fair (Visible wear, works fine)</option>
                <option value="POOR">Poor (Needs minor fix)</option>
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
              placeholder="Describe condition, specifications, campus pickup location (e.g. Hostel 4), and what accessories are included..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Photos (Upload + Presets) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Photos (Up to 5)
            </label>
            <div className="space-y-3">
              {/* Photo thumbnails */}
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {photos.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative w-24 h-24 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Uploaded item" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-90 hover:opacity-100 transition shadow"
                        title="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Input & Quick Preset Buttons */}
              {photos.length < 5 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 text-slate-600 hover:text-blue-600 text-xs font-semibold transition bg-slate-50 hover:bg-blue-50/50">
                    <Upload className="w-4 h-4" />
                    <span>{uploading ? "Uploading..." : "Upload JPEG, PNG, or WebP (Max 5MB)"}</span>
                    <input
                      type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      multiple
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>or quick demo illustration:</span>
                    <button
                      type="button"
                      onClick={() => addPresetPhoto(category)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      + Use {category.toLowerCase()} graphic
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pricing & Increment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Starting Price (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(e.target.value)}
                  placeholder="e.g. 1200"
                  required
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Minimum Bid Increment (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={minIncrement}
                  onChange={(e) => setMinIncrement(e.target.value)}
                  placeholder="e.g. 50"
                  required
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Closing Date & Time */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Auction Closing Date &amp; Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={closingAt}
              onChange={(e) => setClosingAt(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Bidding strictly stops when this time passes. If bids arrive in the last 30s, 60s extension triggers automatically.
            </p>
          </div>

          {/* Notice about locking after first bid */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <strong>Auction Integrity Rule:</strong> Once the first bid is placed by a buyer, starting price, minimum increment, and closing time will be locked and cannot be edited. Text and photos can still be edited.
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || uploading}
              className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              {loading ? "Publishing Auction..." : "Publish Campus Auction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
