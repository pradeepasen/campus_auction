import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Helper to create simple colorful SVG illustrations for demo items
function createDemoSvg(category: string, title: string, color: string): string {
  const filename = `${category.toLowerCase()}-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.svg`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <defs>
      <linearGradient id="grad-${filename}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#1e293b" stop-opacity="0.95" />
      </linearGradient>
    </defs>
    <rect width="600" height="400" fill="url(#grad-${filename})" rx="16"/>
    <circle cx="300" cy="180" r="70" fill="#ffffff" fill-opacity="0.12" />
    <text x="300" y="165" font-family="sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">
      ${category.toUpperCase()}
    </text>
    <text x="300" y="210" font-family="sans-serif" font-size="18" fill="#e2e8f0" text-anchor="middle">
      Campus Senior Leaving Sale
    </text>
    <rect x="100" y="270" width="400" height="45" rx="8" fill="#000000" fill-opacity="0.3" />
    <text x="300" y="298" font-family="sans-serif" font-size="16" font-weight="600" fill="#38bdf8" text-anchor="middle">
      ${title.length > 36 ? title.substring(0, 33) + "..." : title}
    </text>
  </svg>`;

  fs.writeFileSync(path.join(uploadDir, filename), svgContent);
  return `/uploads/${filename}`;
}

async function main() {
  console.log("🌱 Starting Campus Auction DB seed...");

  // Clear existing data
  await prisma.notification.deleteMany();
  await prisma.assistantProposal.deleteMany();
  await prisma.want.deleteMany();
  await prisma.question.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.autoBid.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Create 4 demo users
  const aarav = await prisma.user.create({
    data: {
      username: "aarav",
      name: "Aarav Sharma",
      email: "aarav@campus.edu",
      passwordHash,
      phone: "+91 98765 43210",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aarav",
    },
  });

  const priya = await prisma.user.create({
    data: {
      username: "priya",
      name: "Priya Patel",
      email: "priya@campus.edu",
      passwordHash,
      phone: "+91 98765 43211",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya",
    },
  });

  const rohit = await prisma.user.create({
    data: {
      username: "rohit",
      name: "Rohit Verma",
      email: "rohit@campus.edu",
      passwordHash,
      phone: "+91 98765 43212",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rohit",
    },
  });

  const ananya = await prisma.user.create({
    data: {
      username: "ananya",
      name: "Ananya Iyer",
      email: "ananya@campus.edu",
      passwordHash,
      phone: "+91 98765 43213",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya",
    },
  });

  console.log("👤 Created 4 demo users: aarav, priya, rohit, ananya (password: password123)");

  const now = Date.now();

  // Create demo listings
  const listingsData = [
    {
      sellerId: aarav.id,
      title: "Hercules Roadeo 21-Speed Cycle",
      category: "CYCLE",
      condition: "FAIR",
      description: "Dual disc brakes, 21-speed Shimano gears. Perfect for campus commuting between hostel and academic blocks. Chain recently oiled.",
      startingPrice: 1200,
      minIncrement: 50,
      currentPrice: 1200,
      closingAt: new Date(now + 2 * 60 * 1000), // Closes in 2 minutes!
      color: "#0284c7",
    },
    {
      sellerId: aarav.id,
      title: "Hero Sprint Pro Mountain Bike",
      category: "CYCLE",
      condition: "GOOD",
      description: "26T single speed mountain bike with front suspension and mudguards. Serviced 2 months ago. Comes with heavy-duty cable lock and key.",
      startingPrice: 2500,
      minIncrement: 100,
      currentPrice: 2800,
      closingAt: new Date(now + 24 * 60 * 60 * 1000), // 1 day
      color: "#0369a1",
      bids: [
        { bidderId: rohit.id, amount: 2600, deltaMin: -120 },
        { bidderId: ananya.id, amount: 2800, deltaMin: -60 },
      ],
    },
    {
      sellerId: priya.id,
      title: "Avon City Cruiser with Front Basket",
      category: "CYCLE",
      condition: "LIKE_NEW",
      description: "Sturdy campus cycle with spacious front basket. Bought last semester, barely used. Super smooth pedaling.",
      startingPrice: 1800,
      minIncrement: 100,
      currentPrice: 1800,
      closingAt: new Date(now + 2 * 24 * 60 * 60 * 1000), // 2 days
      color: "#0f766e",
    },
    {
      sellerId: priya.id,
      title: "Casio fx-991EX ClassWiz Scientific Calculator",
      category: "CALCULATOR",
      condition: "LIKE_NEW",
      description: "Essential for all engineering math & exam papers. High resolution display, solar & battery dual power, 552 functions. Original slide-on hard case included.",
      startingPrice: 650,
      minIncrement: 25,
      currentPrice: 725,
      closingAt: new Date(now + 5 * 60 * 1000), // Closes in 5 minutes!
      color: "#7c3aed",
      bids: [
        { bidderId: rohit.id, amount: 675, deltaMin: -20 },
        { bidderId: ananya.id, amount: 725, deltaMin: -5 },
      ],
    },
    {
      sellerId: aarav.id,
      title: "Texas Instruments TI-84 Plus Graphing Calculator",
      category: "CALCULATOR",
      condition: "GOOD",
      description: "Programmable graphing calculator. Used for signal processing and statistics projects. Fresh AAA batteries included.",
      startingPrice: 3000,
      minIncrement: 150,
      currentPrice: 3000,
      closingAt: new Date(now + 3 * 24 * 60 * 60 * 1000), // 3 days
      color: "#6d28d9",
    },
    {
      sellerId: priya.id,
      title: "CLRS: Introduction to Algorithms (4th Edition)",
      category: "BOOKS",
      condition: "LIKE_NEW",
      description: "The bible of algorithms. Hardcover edition with zero pen marks or highlights. Must have for placement prep and coding interviews.",
      startingPrice: 800,
      minIncrement: 50,
      currentPrice: 950,
      closingAt: new Date(now + 60 * 60 * 1000), // Closes in 1 hour!
      color: "#d97706",
      bids: [
        { bidderId: rohit.id, amount: 850, deltaMin: -40 },
        { bidderId: ananya.id, amount: 950, deltaMin: -15 },
      ],
    },
    {
      sellerId: aarav.id,
      title: "Higher Engineering Mathematics by B.S. Grewal (44th Ed)",
      category: "BOOKS",
      condition: "GOOD",
      description: "Standard syllabus textbook for Sem 1-4 math. Clean pages, no torn sheets. Super helpful for end-semester exams.",
      startingPrice: 350,
      minIncrement: 25,
      currentPrice: 350,
      closingAt: new Date(now + 24 * 60 * 60 * 1000), // 1 day
      color: "#b45309",
    },
    {
      sellerId: priya.id,
      title: "GATE CS & IT Previous 15 Years Solved Papers",
      category: "BOOKS",
      condition: "GOOD",
      description: "Made Easy chapter-wise solved questions from 2008 to 2023 with detailed answer explanations.",
      startingPrice: 400,
      minIncrement: 20,
      currentPrice: 440,
      closingAt: new Date(now + 3 * 24 * 60 * 60 * 1000), // 3 days
      color: "#92400e",
      bids: [
        { bidderId: rohit.id, amount: 440, deltaMin: -100 },
      ],
    },
    {
      sellerId: priya.id,
      title: "Raspberry Pi 4 Model B (4GB RAM) + Case & Adapter",
      category: "ELECTRONICS",
      condition: "LIKE_NEW",
      description: "Includes official power supply, micro-HDMI cable, heatsinks, and a 32GB SanDisk Ultra MicroSD pre-flashed with Raspberry Pi OS.",
      startingPrice: 3200,
      minIncrement: 100,
      currentPrice: 3500,
      closingAt: new Date(now + 4 * 60 * 60 * 1000), // 4 hours
      color: "#be123c",
      bids: [
        { bidderId: rohit.id, amount: 3300, deltaMin: -180 },
        { bidderId: ananya.id, amount: 3500, deltaMin: -30 },
      ],
    },
    {
      sellerId: aarav.id,
      title: "Logitech K380 Multi-Device Bluetooth Keyboard",
      category: "ELECTRONICS",
      condition: "GOOD",
      description: "Pairs with up to 3 devices simultaneously (Laptop, iPad, Phone). Compact and silent keys, perfect for library sessions.",
      startingPrice: 1100,
      minIncrement: 50,
      currentPrice: 1100,
      closingAt: new Date(now + 24 * 60 * 60 * 1000), // 1 day
      color: "#059669",
    },
    {
      sellerId: priya.id,
      title: "Arduino Uno R3 Starter Kit with 30+ Sensors",
      category: "ELECTRONICS",
      condition: "NEW",
      description: "Unopened components: ultrasonic sensor, servo motors, LCD display, jumper wires, breadboard, resistors, LEDs. Ideal for IoT mini-projects.",
      startingPrice: 950,
      minIncrement: 50,
      currentPrice: 1050,
      closingAt: new Date(now + 2 * 24 * 60 * 60 * 1000), // 2 days
      color: "#0d9488",
      bids: [
        { bidderId: rohit.id, amount: 1050, deltaMin: -45 },
      ],
    },
    {
      sellerId: aarav.id,
      title: "Noise Two Wireless Bluetooth Headphones (50h Playtime)",
      category: "ELECTRONICS",
      condition: "LIKE_NEW",
      description: "Over-ear headphones with deep bass mode, dual pairing, low latency for gaming, and up to 50 hours battery life. With aux cable and box.",
      startingPrice: 700,
      minIncrement: 50,
      currentPrice: 800,
      closingAt: new Date(now + 6 * 60 * 60 * 1000), // 6 hours
      color: "#4338ca",
      bids: [
        { bidderId: ananya.id, amount: 750, deltaMin: -90 },
        { bidderId: rohit.id, amount: 800, deltaMin: -10 },
      ],
    },
    {
      sellerId: priya.id,
      title: "Adjustable Campus Desk Study Lamp (3 Color Modes)",
      category: "OTHER",
      condition: "GOOD",
      description: "Touch-sensitive desk lamp with warm, natural, and white light options. Flexible gooseneck and USB charging port.",
      startingPrice: 250,
      minIncrement: 20,
      currentPrice: 250,
      closingAt: new Date(now + 2 * 24 * 60 * 60 * 1000), // 2 days
      color: "#e11d48",
    },
    {
      sellerId: aarav.id,
      title: "Yonex Carbonex 8000 Plus Badminton Racket + 3 Shuttles",
      category: "OTHER",
      condition: "LIKE_NEW",
      description: "Graphite shaft racket strung at 24 lbs tension with Yonex BG-65 strings. Comes with full head cover and 3 Yonex Mavis 350 shuttles.",
      startingPrice: 850,
      minIncrement: 50,
      currentPrice: 900,
      closingAt: new Date(now + 3 * 24 * 60 * 60 * 1000), // 3 days
      color: "#15803d",
      bids: [
        { bidderId: ananya.id, amount: 900, deltaMin: -35 },
      ],
    },
    // Past completed auction to test closed tab
    {
      sellerId: aarav.id,
      title: "Single Hostel Foam Mattress (6x3 ft)",
      category: "OTHER",
      condition: "GOOD",
      description: "Clean, high density foam mattress used for 2 semesters. No sagging. Fits standard campus hostel cots.",
      startingPrice: 400,
      minIncrement: 50,
      currentPrice: 650,
      closingAt: new Date(now - 24 * 60 * 60 * 1000), // Closed yesterday
      status: "COMPLETED",
      outcome: "Campus handover completed. Delivered to @rohit for ₹650.",
      winnerId: rohit.id,
      color: "#475569",
      bids: [
        { bidderId: ananya.id, amount: 500, deltaMin: -1500 },
        { bidderId: rohit.id, amount: 650, deltaMin: -1450 },
      ],
    },
    // Past unsold auction to test closed tab
    {
      sellerId: priya.id,
      title: "White Chemistry Lab Coat (Size 40) + Safety Goggles",
      category: "OTHER",
      condition: "FAIR",
      description: "Standard cotton white lab coat and scratch-resistant safety goggles for 1st year chemistry lab.",
      startingPrice: 300,
      minIncrement: 20,
      currentPrice: 300,
      closingAt: new Date(now - 12 * 60 * 60 * 1000), // Closed 12 hours ago
      status: "CLOSED_UNSOLD",
      outcome: "Closed without any bids.",
      color: "#64748b",
    },
  ];

  for (const item of listingsData) {
    const photoUrl = createDemoSvg(item.category, item.title, item.color);

    const listing = await prisma.listing.create({
      data: {
        sellerId: item.sellerId,
        title: item.title,
        category: item.category,
        condition: item.condition,
        description: item.description,
        photos: JSON.stringify([photoUrl]),
        startingPrice: item.startingPrice,
        minIncrement: item.minIncrement,
        currentPrice: item.currentPrice,
        closingAt: item.closingAt,
        originalClosingAt: item.closingAt,
        status: item.status || "ACTIVE",
        outcome: item.outcome || null,
        winnerId: item.winnerId || null,
      },
    });

    if (item.bids && item.bids.length > 0) {
      let lastBidId: string | undefined;
      for (const b of item.bids) {
        const bidTime = new Date(now + b.deltaMin * 60 * 1000);
        const createdBid = await prisma.bid.create({
          data: {
            listingId: listing.id,
            bidderId: b.bidderId,
            amount: b.amount,
            isAutoBid: false,
            createdAt: bidTime,
          },
        });
        lastBidId = createdBid.id;
      }
      if (item.status === "COMPLETED" && lastBidId) {
        await prisma.listing.update({
          where: { id: listing.id },
          data: { winningBidId: lastBidId },
        });
      }
    }
  }

  // Seed sample wants for demonstration
  await prisma.want.create({
    data: {
      userId: rohit.id,
      keywords: "cycle mountain",
      category: "CYCLE",
      maxPrice: 3000,
    },
  });

  await prisma.want.create({
    data: {
      userId: ananya.id,
      keywords: "scientific calculator casio",
      category: "CALCULATOR",
      maxPrice: 800,
    },
  });

  console.log(`✅ Seeded ${listingsData.length} listings with realistic closing times & bids.`);
  console.log("🏁 Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
