# 🎓 CampusBids — Campus Senior Exit Fair Auction

> **Hackathon Web App**: The fair marketplace where campus competes transparently for leaving seniors' cycles, calculators, books, and electronics.

---

## 📖 The Story
It is the last day of final semester exams. Seniors are leaving campus within a week and leaving behind cycles, calculators, books, and electronics. Juniors need them, but historically they were sold in chaotic WhatsApp/Telegram chat groups where the fastest person to type wins and the price is sheer guesswork. 

**CampusBids** is the platform where campus competes fairly so every item finds its next owner. Every item has its own dedicated auction, closing transparently at its own specified time.

---

## ⚡ Tech Stack & Architecture

- **Framework**: Next.js (App Router) + TypeScript + React 18
- **Database**: SQLite with Prisma ORM
- **Styling**: Tailwind CSS + custom accessible components
- **Authentication**: Session cookie with `bcryptjs` hashed passwords
- **File Uploads**: Local storage under `/public/uploads` (JPEG/PNG/SVG)
- **Live Updates**: Server polling every 2 seconds with background tick auto-closing
- **Security & Privacy**: Secrets in `.env` only; student emails, phones, and passwords are never exposed publicly or to assistants.

---

## 🚀 Quick Start & How to Run

### 1. Prerequisites
- Node.js (v18+ or v20+)
- npm

### 2. Install Dependencies
```bash
npm install
```

### 3. Initialize Database & Seed
```bash
npm run seed
```
*This synchronizes the SQLite schema and seeds 4 demo student profiles, 16 realistic listings across all categories with varying closing times (from 2 minutes to 3 days), existing bids, and sample wishlist wants.*

### 4. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 👥 Registered Campus Accounts

All registered student accounts can sign in manually on `/login`:

| Username | Student Name | Role & Department | Bio / Listing Focus | Password |
|---|---|---|---|---|
| `aarav` | Aarav Sharma | Senior • Mechanical | Selling cycle, TI-84 calculator, B.S. Grewal math, headphones | `password123` |
| `priya` | Priya Patel | Senior • Computer Science | Selling Casio ClassWiz, CLRS 4th Ed, Raspberry Pi 4 kit, desk lamp | `password123` |
| `rohit` | Rohit Verma | Junior • Electrical | Active buyer looking for campus cycles & engineering books | `password123` |
| `ananya` | Ananya Iyer | Junior • Information Tech | Active buyer looking for electronics and scientific calculators | `password123` |

---

## 🛠️ Phase 1 Features Implemented

1. **Database Schema & Prisma Setup**:
   - `User`, `Listing`, `Bid`, `AutoBid`, `Question`, `Want`, `Notification`, and `AssistantProposal` models.
   - All listing statuses: `ACTIVE`, `CLOSED_UNSOLD`, `PENDING_APPROVAL`, `RESERVED`, `COMPLETED`, `REJECTED`, `CANCELLED`, `PICKUP_FAILED`.

2. **Session Authentication**:
   - Secure signed session cookies with hashed passwords using `bcryptjs`.
   - 1-click user switcher in Navbar for seamless testing between buyers and sellers.

3. **Listings Management**:
   - **Create Listing** (`/listings/new`):
     - Title, category (cycle, calculator, books, electronics, other), condition (new, like new, good, fair, poor), photos (up to 5), starting price (₹), minimum bid increment (₹), closing date and time.
     - Server validations: closing time strictly in the future, price and increment > ₹0.
     - Supports uploading files directly to `/public/uploads` or selecting instant SVG demo graphics.
   - **Edit Listing** (`/listings/[id]/edit`):
     - **Integrity Rule**: After the first bid is placed, starting price, minimum increment, and closing time are **locked**. Text description and photos can still be edited.
   - **Cancel Listing**:
     - Sellers can cancel their active listing. Cancelling sets the status to `CANCELLED`, records the outcome `"Cancelled by seller"`, and notifies all active bidders.
   - **Self-Bidding Restriction**:
     - Sellers are strictly prevented from bidding on their own listings.

4. **Browsing & Public Auctions**:
   - Live countdown timer computed against server time.
   - Search by keyword across title and description.
   - Combined filters: category, condition, price range (₹ min / max), closing soon (<1h, <24h).
   - Tabbed view: "Active Auctions" vs "Past & Closed" (with distinct outcome badges).
   - Full public bid history on every listing page (bidder username, amount in ₹, and timestamp).

5. **Server-Side Enforcement**:
   - Central rule service in `lib/auction-service.ts`.
   - Automatic background closing tick (`/api/tick`) synchronized every 2 seconds. Every read query also evaluates expired listings to ensure an auction is never displayed as active past its deadline.
