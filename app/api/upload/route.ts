import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import fs from "node:fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_FORMATS = [
  {
    mimeType: "image/jpeg",
    extension: ".jpg",
    matches: (bytes: Buffer) =>
      bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    mimeType: "image/png",
    extension: ".png",
    matches: (bytes: Buffer) =>
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: "image/webp",
    extension: ".webp",
    matches: (bytes: Buffer) =>
      bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP",
  },
] as const;

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (files.length > 5) {
      return NextResponse.json(
        { error: "A maximum of 5 photos can be uploaded per listing." },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const preparedFiles: Array<{ buffer: Buffer; extension: string; name: string }> = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Upload valid image files only." },
          { status: 400 }
        );
      }

      if (file.size === 0 || file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" must be larger than 0 bytes and no more than 5MB.` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const format = IMAGE_FORMATS.find((candidate) => candidate.matches(buffer));
      if (!format) {
        return NextResponse.json(
          { error: `File "${file.name}" is not a supported JPEG, PNG, or WebP image.` },
          { status: 400 }
        );
      }
      preparedFiles.push({ buffer, extension: format.extension, name: file.name });
    }

    const uploadedPaths: string[] = [];
    try {
      const urls: string[] = [];
      for (const file of preparedFiles) {
        const fileName = `${crypto.randomUUID()}${file.extension}`;
        const filePath = path.join(uploadDir, fileName);
        await fs.writeFile(filePath, file.buffer, { flag: "wx" });
        uploadedPaths.push(filePath);
        urls.push(`/api/uploads/${fileName}`);
      }
      return NextResponse.json({ urls });
    } catch (error) {
      await Promise.all(
        uploadedPaths.map((filePath) => fs.unlink(filePath).catch(() => undefined))
      );
      throw error;
    }
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload files" },
      { status: 500 }
    );
  }
}
