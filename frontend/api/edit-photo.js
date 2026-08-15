import { InferenceClient } from "@huggingface/inference";

const MODEL = "black-forest-labs/FLUX.1-Kontext-dev";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        status: false,
        error: "Method Not Allowed"
      });
    }

    const imageUrl = String(req.query?.image || "").trim();
    const prompt = String(req.query?.prompt || "").trim();

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

    let parsedUrl;

    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return res.status(400).json({
        status: false,
        error: "URL gambar tidak valid"
      });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        status: false,
        error: "URL gambar harus menggunakan HTTP atau HTTPS"
      });
    }

    const token = process.env.HF_TOKEN;

    if (!token) {
      return res.status(500).json({
        status: false,
        error: "HF_TOKEN belum dikonfigurasi"
      });
    }

    let imageResponse;

    try {
      imageResponse = await fetch(imageUrl);
    } catch (error) {
      return res.status(400).json({
        status: false,
        error: "Gagal download gambar",
        detail: error?.message || String(error)
      });
    }

    if (!imageResponse.ok) {
      return res.status(400).json({
        status: false,
        error: "Gagal download gambar dari URL",
        http_status: imageResponse.status
      });
    }

    const inputType =
      imageResponse.headers.get("content-type") || "image/jpeg";

    if (!inputType.startsWith("image/")) {
      return res.status(400).json({
        status: false,
        error: "URL tersebut bukan file gambar",
        content_type: inputType
      });
    }

    const imageBuffer = Buffer.from(
      await imageResponse.arrayBuffer()
    );

    const inputBlob = new Blob(
      [imageBuffer],
      {
        type: inputType
      }
    );

    const client = new InferenceClient(token);

    let output;

    try {
      output = await client.imageToImage({
        provider: "fal-ai",
        model: MODEL,
        inputs: inputBlob,
        parameters: {
          prompt: prompt
        }
      });
    } catch (error) {
      console.error("HF ERROR:", error);

      return res.status(503).json({
        status: false,
        error: "Gagal memproses gambar melalui HF",
        detail: error?.message || String(error),
        provider: "fal-ai",
        model: MODEL
      });
    }

    if (!output) {
      return res.status(502).json({
        status: false,
        error: "HF tidak mengembalikan gambar"
      });
    }

    const outputBuffer = Buffer.from(
      await output.arrayBuffer()
    );

    if (!outputBuffer.length) {
      return res.status(502).json({
        status: false,
        error: "Hasil gambar kosong"
      });
    }

    const outputType =
      output.type && output.type.startsWith("image/")
        ? output.type
        : "image/png";

    res.setHeader("Content-Type", outputType);
    res.setHeader("Content-Length", outputBuffer.length);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error("EDIT PHOTO ERROR:", error);

    return res.status(500).json({
      status: false,
      error: error?.message || "Internal Server Error"
    });
  }
}
