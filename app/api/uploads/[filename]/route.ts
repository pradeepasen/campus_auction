import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: { filename: string } }
) {
  const { filename } = params;
  const extension = path.extname(filename).toLowerCase();
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename) || !IMAGE_TYPES[extension]) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const imagePath = path.join(process.cwd(), "public", "uploads", filename);
  try {
    const image = await fs.readFile(imagePath);
    return new NextResponse(image, {
      headers: {
        "Content-Type": IMAGE_TYPES[extension],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }
    console.error("Uploaded image read error:", error);
    return NextResponse.json({ error: "Could not load image." }, { status: 500 });
  }
}
