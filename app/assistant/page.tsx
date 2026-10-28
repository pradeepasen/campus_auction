"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowLeft, Bot, ShieldCheck } from "lucide-react";

export default function AssistantPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to auctions
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-100">
          <Bot className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Campus Auction AI Assistant
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto mt-2">
          Ask questions like &ldquo;find me a cycle under ₹2,000&rdquo; or propose actions with tool calling.
        </p>
        <div className="mt-6 p-4 max-w-lg mx-auto rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2 text-left">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>Safety &amp; Privacy First:</strong> The assistant strictly interacts only with public listing data and never has access to private credentials or contacts. Actions always require your explicit button approval.
          </span>
        </div>
      </div>
    </div>
  );
}
