import { InferenceClient } from "@huggingface/inference";

const MODEL = "black-forest-labs/FLUX.2-klein-9B";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        status: false,
        error: "Method Not Allowed",
        allowed: ["GET"]
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

    if (!/^https?:\/\//i.test(imageUrl)) {
      return res.status(400).json({
        status: false,
        error: "image harus berupa URL http/https"
      });
    }

    const token = process.env.HF_TOKEN;

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

    const client = new InferenceClient(token);

    let output;

    try {
      output = await client.imageToImage({
        provider: "fal-ai",
        model: MODEL,
        inputs: imageBuffer,
        parameters: {
          prompt
        }
      });
    } catch (error) {
      console.error("HF FAL-AI ERROR:", error);

      return res.status(503).json({
        status: false,
        error: "Gagal memproses gambar melalui HF fal-ai",
        detail: error?.message || String(error),
        model: MODEL,
        provider: "fal-ai"
      });
    }

    const outputBuffer = Buffer.from(
      await output.arrayBuffer()
    );

    const outputType =
      output.type || "image/png";

    res.setHeader("Content-Type", outputType);
    res.setHeader("Content-Length", outputBuffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", "inline");

    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error("EDIT PHOTO ERROR:", error);

    return res.status(500).json({
      status: false,
      error: error?.message || "Internal Server Error"
    });
  }
}
