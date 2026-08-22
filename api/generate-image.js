import { generatePollinationsImage } from "./_image.js";

export default async function handler(req, res) {
  try {
    let prompt = "";

    if (req.method === "GET") {
      prompt = String(req.query?.prompt || "").trim();
    } else if (req.method === "POST") {
      const body = req.body || {};
      prompt = String(body.prompt || "").trim();
    } else {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({
        status: false,
        error: "Method Not Allowed"
      });
    }

    if (!prompt) {
      return res.status(400).json({
        status: false,
        error: "prompt wajib diisi"
      });
    }

    const { buffer, mime } = await generatePollinationsImage(prompt);

    res.statusCode = 200;
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");

    return res.end(buffer);

  } catch (e) {
    console.error(e);

    return res.status(500).json({
      status: false,
      error: e.message || "Image generation failed",
      detail: e.detail
    });
  }
}
