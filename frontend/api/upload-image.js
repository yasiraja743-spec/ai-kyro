import crypto from "node:crypto";
import {
  S3Client,
  PutObjectCommand
} from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      status: false,
      error: "Method Not Allowed"
    });
  }

  const requiredEnv = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL"
  ];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length) {
    return res.status(500).json({
      status: false,
      error: "Konfigurasi R2 belum lengkap di Environment Variables",
      missing: missingEnv
    });
  }

  try {
    const contentType =
      req.headers["content-type"] || "";

    if (!contentType.startsWith("image/")) {
      return res.status(400).json({
        status: false,
        error: "Kirim file gambar langsung dengan Content-Type image/*"
      });
    }

    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    if (!buffer.length) {
      return res.status(400).json({
        status: false,
        error: "File gambar kosong"
      });
    }

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(413).json({
        status: false,
        error: "Ukuran gambar maksimal 10MB"
      });
    }

    const ext =
      contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
        ? "webp"
        : contentType === "image/gif"
        ? "gif"
        : "jpg";

    const filename =
      `uploads/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=86400"
      })
    );

    const publicUrl =
      `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${filename}`;

    return res.status(200).json({
      status: true,
      url: publicUrl,
      filename,
      content_type: contentType,
      size: buffer.length
    });

  } catch (error) {
    console.error("R2 UPLOAD ERROR:", error);

    return res.status(500).json({
      status: false,
      error: "Gagal upload gambar",
      detail: error?.message || String(error)
    });
  }
}
