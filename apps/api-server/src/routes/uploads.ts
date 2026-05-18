import { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const uploadsRouter = Router({ mergeParams: true });

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ImageUploadSchema = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().min(1),
});

function getSupabaseStorageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!url || !serviceRoleKey || !bucket) return null;

  return {
    url,
    serviceRoleKey,
    bucket,
    publicBaseUrl: (process.env.SUPABASE_STORAGE_PUBLIC_URL ?? `${url}/storage/v1/object/public/${bucket}`).replace(/\/+$/, ""),
  };
}

function decodeBase64Image(data: string): Buffer | null {
  const base64 = data.includes(",") ? data.split(",").at(-1) : data;
  if (!base64) return null;
  return Buffer.from(base64, "base64");
}

async function uploadToSupabaseStorage(
  buffer: Buffer,
  contentType: keyof typeof ALLOWED_TYPES,
  objectPath: string,
): Promise<string> {
  const config = getSupabaseStorageConfig();
  if (!config) {
    throw new Error("Supabase storage is not configured");
  }

  const response = await fetch(`${config.url}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Cache-Control": "31536000",
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body: buffer,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase storage upload failed: ${response.status} ${text}`);
  }

  return `${config.publicBaseUrl}/${objectPath}`;
}

uploadsRouter.post("/product-image", async (req, res): Promise<void> => {
  const storeId = Number((req.params as { storeId?: string }).storeId);
  const parsed = ImageUploadSchema.safeParse(req.body);
  if (!storeId || !parsed.success) {
    res.status(400).json({ error: "Invalid image upload" });
    return;
  }

  const buffer = decodeBase64Image(parsed.data.data);
  if (!buffer || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    res.status(413).json({ error: "Image size must be 5MB or less" });
    return;
  }

  const ext = ALLOWED_TYPES[parsed.data.contentType];
  const safeBase = parsed.data.fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "product";
  const fileName = `${Date.now()}-${randomUUID()}-${safeBase}.${ext}`;
  const objectPath = `stores/${storeId}/${fileName}`;

  const storageConfig = getSupabaseStorageConfig();
  if (storageConfig) {
    const url = await uploadToSupabaseStorage(buffer, parsed.data.contentType, objectPath);
    res.status(201).json({ url });
    return;
  }

  if (process.env.NODE_ENV === "production") {
    res.status(503).json({ error: "Image storage is not configured for production" });
    return;
  }

  const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
  const storeDir = path.join(uploadRoot, "stores", String(storeId));
  await mkdir(storeDir, { recursive: true });
  const filePath = path.join(storeDir, fileName);
  await writeFile(filePath, buffer);
  res.status(201).json({
    url: `/uploads/stores/${storeId}/${fileName}`,
  });
});
