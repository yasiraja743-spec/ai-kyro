import { hfToken } from "./_hf.js";

const MODEL = "Qwen/Qwen-Image-Edit";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        status: false,
        error: "Method Not Allowed"
      });
    }

    const imageUrl = String(req.query.image || "").trim();
    const prompt = String(req.query.prompt || "").trim();

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

    let image;

    try {
      image = await fetch(imageUrl);
    } catch (error) {
      return res.status(400).json({
        status: false,
        error: "Gagal download gambar dari URL",
        detail: error.message
      });
    }

    if (!image.ok) {
      return res.status(400).json({
        status: false,
        error: "URL gambar tidak bisa diakses",
        http_status: image.status
      });
    }

    const contentType =
      image.headers.get("content-type") || "image/jpeg";

    if (!contentType.startsWith("image/")) {
      return res.status(400).json({
        status: false,
        error: "URL tersebut bukan file gambar",
        content_type: contentType
      });
    }

    const imageBuffer = Buffer.from(
      await image.arrayBuffer()
    );

    const form = new FormData();

    form.append(
      "image",
      new Blob([imageBuffer], {
        type: contentType
      }),
      "input.jpg"
    );

    form.append("prompt", prompt);

    let hfResponse;

    try {
      hfResponse = await fetch(
        `https://api-inference.huggingface.co/models/${MODEL}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: form
        }
      );
    } catch (error) {
      return res.status(503).json({
        status: false,
        error: "Gagal menghubungi Hugging Face",
        detail: error.message
      });
    }

    if (!hfResponse.ok) {
      const errorText = await hfResponse.text();

      return res.status(hfResponse.status).json({
        status: false,
        error: "Hugging Face gagal memproses gambar",
        detail: errorText
      });
    }

    const resultBuffer = Buffer.from(
      await hfResponse.arrayBuffer()
    );

    const resultType =
      hfResponse.headers.get("content-type") ||
      "image/png";

    res.setHeader("Content-Type", resultType);
    res.setHeader("Content-Length", resultBuffer.length);
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(resultBuffer);

  } catch (error) {
    console.error("EDIT PHOTO ERROR:", error);

    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
}
