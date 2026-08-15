import { hfToken } from "./_hf.js";

const MODEL = "Qwen/Qwen-Image-Edit";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        status: false,
        error: "Method Not Allowed"
      });
    }

    const imageUrl =
      req.method === "GET"
        ? req.query?.image
        : req.body?.image;

    const prompt =
      req.method === "GET"
        ? req.query?.prompt
        : req.body?.prompt;

    if (!imageUrl) {
      return res.status(400).json({
        status: false,
        error: "Parameter image wajib diisi"
      });
    }

    if (!prompt) {
      return res.status(400).json({
        status: false,
        error: "Parameter prompt wajib diisi"
      });
    }

    const token = hfToken();

    if (!token) {
      return res.status(500).json({
        status: false,
        error: "HF_TOKEN belum dikonfigurasi"
      });
    }

    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      return res.status(400).json({
        status: false,
        error: "Gagal mengambil gambar dari URL",
        http_status: imageResponse.status
      });
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const form = new FormData();

    form.append(
      "image",
      new Blob([imageBuffer], {
        type: imageResponse.headers.get("content-type") || "image/jpeg"
      }),
      "input.jpg"
    );

    form.append("prompt", String(prompt));

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
      }
    );

    if (!response.ok) {
      const text = await response.text();

      return res.status(response.status).json({
        status: false,
        error: text || `Hugging Face HTTP ${response.status}`
      });
    }

    const resultBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    const contentType =
      response.headers.get("content-type") || "image/png";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", resultBuffer.length);
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    return res.status(200).send(resultBuffer);

  } catch (error) {
    console.error("EDIT IMAGE ERROR:", error);

    return res.status(500).json({
      status: false,
      error: error?.message || "Internal Server Error"
    });
  }
}
