import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "CampusBids - Senior Exit Fair Auction",
  description:
    "Fair campus auctions for cycles, calculators, books, and electronics as seniors leave campus.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="font-sans min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
        <Navbar />
        <main className="flex-1 pb-16">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>🎓 Campus Senior Leaving Fair Auction • Currency: INR (₹)</span>
            <span>All bidding rules enforced server-side with atomic transactions.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
