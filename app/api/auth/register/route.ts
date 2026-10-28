import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionCookie, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const username =
      typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!name || !username || !email || !password) {
      return NextResponse.json(
        { error: "Name, username, email, and password are required." },
        { status: 400 }
      );
    }

    if (name.length > 80) {
      return NextResponse.json({ error: "Name must be 80 characters or fewer." }, { status: 400 });
    }

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3–24 characters using letters, numbers, or underscores." },
        { status: 400 }
      );
    }

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const passwordBytes = Buffer.byteLength(password, "utf8");
    if (passwordBytes < 8 || passwordBytes > 72) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters and no more than 72 bytes." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { username: true, email: true },
    });

    if (existingUser) {
      const field = existingUser.username === username ? "Username" : "Email";
      return NextResponse.json(
        { error: `${field} is already registered.` },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        passwordHash: await hashPassword(password),
      },
      select: { id: true, username: true, name: true, avatar: true },
    });

    await createSessionCookie(user.id);

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Username or email is already registered." },
        { status: 409 }
      );
    }

    console.error("Registration route error:", err);
    return NextResponse.json(
      { error: "Unable to create your account right now." },
      { status: 500 }
    );
  }
}
