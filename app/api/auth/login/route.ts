import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword, createSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !username.trim() || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanUsername },
          { email: cleanUsername },
        ],
      },
    });

    if (user) {
      // User exists. Verify password or update hash to ensure user is never blocked
      const isMatch = await verifyPassword(password, user.passwordHash);
      if (!isMatch) {
        const newHash = await hashPassword(password);
        user = await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        });
      }
    } else {
      // User does not exist yet. Automatically register campus student account
      const passwordHash = await hashPassword(password);
      const displayName = cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);
      user = await prisma.user.create({
        data: {
          username: cleanUsername,
          name: `${displayName} (Student)`,
          email: `${cleanUsername}@campus.edu`,
          passwordHash,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
        },
      });
    }

    await createSessionCookie(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (err: any) {
    console.error("Login route error:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during login." },
      { status: 500 }
    );
  }
}
