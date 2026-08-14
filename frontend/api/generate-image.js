import { InferenceClient } from "@huggingface/inference";
import { hfToken, json, parseJson } from "./_hf.js";

const MODEL = "Qwen/Qwen-Image-2512";

export default async function handler(req, res) {
  try {
    let body = {};

    if (req.method === "GET") {
      body = req.query || {};
    } else if (req.method === "POST") {
      body = await parseJson(req);
    } else {
      return json(res, 405, {
        status: false,
        error: "Method Not Allowed",
        allowed: ["GET", "POST"]
      });
    }

    const prompt = String(body.prompt || "").trim();

    if (!prompt) {
      return json(res, 400, {
        status: false,
        error: "prompt wajib diisi"
      });
    }

    const token = hfToken();

    if (!token) {
      return json(res, 500, {
        status: false,
        error: "HF_TOKEN belum dikonfigurasi"
      });
    }

    const client = new InferenceClient(token);

    const image = await client.textToImage({
      model: MODEL,
      inputs: prompt,
      provider: "auto"
    });

    const buffer = Buffer.from(await image.arrayBuffer());
    const mime = image.type || "image/png";

    return json(res, 200, {
      status: true,
      model: MODEL,
      prompt,
      image: `data:${mime};base64,${buffer.toString("base64")}`
    });

  } catch (e) {
    console.error("NOVA AI T2I:", e);

    return json(res, 500, {
      status: false,
      error: e?.message || "Image generation failed"
    });
  }
}
