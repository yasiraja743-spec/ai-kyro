import { generateCloudflareImage } from "./_image.js";

export const maxDuration = 60;

const ALLOWED_ASPECT_RATIOS = new Set([
  "1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2",
  "9:19.5", "19.5:9", "9:20", "20:9", "1:2", "2:1", "auto"
]);
const ALLOWED_QUALITY = new Set(["low", "medium"]);
const ALLOWED_RESOLUTION = new Set(["1k", "2k"]);

function getValue(req, body, key) {
  return req.method === "GET" ? req.query?.[key] : body?.[key];
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ status: false, error: "Method Not Allowed" });
    }

    const body = req.method === "POST" ? (req.body || {}) : {};
    const prompt = String(getValue(req, body, "prompt") || "").trim();

    if (!prompt) {
      return res.status(400).json({ status: false, error: "prompt wajib diisi" });
    }

    const aspectRatio = String(getValue(req, body, "aspect_ratio") || "1:1");
    const quality = String(getValue(req, body, "quality") || "medium");
    const resolution = String(getValue(req, body, "resolution") || "1k");

    if (!ALLOWED_ASPECT_RATIOS.has(aspectRatio)) {
      return res.status(400).json({ status: false, error: "aspect_ratio tidak didukung" });
    }
    if (!ALLOWED_QUALITY.has(quality)) {
      return res.status(400).json({ status: false, error: "quality harus low atau medium" });
    }
    if (!ALLOWED_RESOLUTION.has(resolution)) {
      return res.status(400).json({ status: false, error: "resolution harus 1k atau 2k" });
    }

    const { buffer, mime } = await generateCloudflareImage(prompt, {
      aspect_ratio: aspectRatio,
      quality,
      resolution
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Image-Model", "xai/grok-imagine-image-2.0");
    return res.end(buffer);
  } catch (e) {
    console.error("IMAGE GENERATION ERROR:", e);
    return res.status(e?.status || 500).json({
      status: false,
      error: e?.message || "Image generation failed",
      detail: e?.detail || undefined
    });
  }
}
