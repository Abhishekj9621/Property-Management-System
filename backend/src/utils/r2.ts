import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";
import { env } from "../config/env";

function isConfigured(): boolean {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME && env.R2_PUBLIC_URL);
}

let client: S3Client | null = null;
function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/**
 * Uploads a single in-memory file (from multer's memoryStorage) to the R2
 * bucket and returns its public URL. Throws a clear error if R2 isn't
 * configured yet, rather than a confusing SDK stack trace.
 */
export async function uploadImageToR2(file: Express.Multer.File, folder: "hotels" | "room-types"): Promise<string> {
  if (!isConfigured()) {
    throw new Error(
      "Photo uploads aren't configured yet — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL."
    );
  }
  if (!ALLOWED_MIME_TYPES[file.mimetype]) {
    throw new Error("Only JPG, PNG, WEBP, and GIF image files are allowed.");
  }

  const ext = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname) || "";
  const key = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return `${env.R2_PUBLIC_URL}/${key}`;
}

export const r2 = { isConfigured, uploadImageToR2 };
