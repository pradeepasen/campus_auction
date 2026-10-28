import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const SESSION_COOKIE_NAME = "campus_auction_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "fallback-secret-campus-auction-2026";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  avatar?: string | null;
}

export interface SessionData {
  userId: string;
  expiresAt: number;
}

function signSession(data: SessionData): string {
  const json = JSON.stringify(data);
  const base64 = Buffer.from(json).toString("base64url");
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(base64).digest("base64url");
  return `${base64}.${hmac}`;
}

function verifySession(token: string): SessionData | null {
  try {
    const [base64, hmac] = token.split(".");
    if (!base64 || !hmac) return null;
    const expectedHmac = crypto.createHmac("sha256", SESSION_SECRET).update(base64).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      return null;
    }
    const data: SessionData = JSON.parse(Buffer.from(base64, "base64url").toString());
    if (Date.now() > data.expiresAt) return null;
    return data;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionCookie(userId: string) {
  const cookieStore = cookies();
  const token = signSession({
    userId,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  });

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const session = verifySession(token);
    if (!session?.userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
      },
    });

    return user;
  } catch {
    return null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = verifySession(token);
  return session?.userId || null;
}
