import { editImageWithIkyyxd } from "./_image.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      status: false,
      error: "Method Not Allowed"
    });
  }

  try {
    let body = {};

    if (req.method === "GET") {
      body = req.query || {};
    } else {
      if (typeof req.body === "object" && req.body !== null) {
        body = req.body;
      } else {
        try {
          body = JSON.parse(req.body || "{}");
        } catch {
          body = {};
        }
      }
    }

    const imageUrl = String(
      body.url ||
      body.image ||
      body.image_url ||
      ""
    ).trim();

    const prompt = String(
      body.prompt ||
      ""
    ).trim();

    if (!imageUrl) {
      return res.status(400).json({
        status: false,
        error: "Parameter url wajib diisi"
      });
    }

    if (!prompt) {
      return res.status(400).json({
        status: false,
        error: "Parameter prompt wajib diisi"
      });
    }

    const { buffer, mime } = await editImageWithIkyyxd(imageUrl, prompt);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", buffer.length.toString());
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(buffer);

  } catch (error) {
    console.error("EDIT PHOTO ERROR:", error);

    return res.status(error.status || 500).json({
      status: false,
      error: error.message || "Internal Server Error",
      ...(error.detail ? { detail: error.detail } : {}),
      ...(error.upstream_status ? { upstream_status: error.upstream_status } : {})
    });
  }
}
