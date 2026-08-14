import { InferenceClient } from "@huggingface/inference";
import { hfToken, json, parseJson } from "./_hf.js";

const MODEL = "Qwen/Qwen-Image-2512";

export default async function handler(req, res) {
  try {
    let body = {};

    // =========================
    // SUPPORT GET
    // =========================
    if (req.method === "GET") {
      body = req.query || {};
    }

    // =========================
    // SUPPORT POST
    // =========================
    else if (req.method === "POST") {
      body = await parseJson(req);
    }

    // =========================
    // METHOD LAIN
    // =========================
    else {
      return json(res, 405, {
        status: false,
        error: "Method Not Allowed",
        allowed: ["GET", "POST"]
      });
    }

    // =========================
    // PROMPT
    // =========================
    const prompt = String(body.prompt || "").trim();

    if (!prompt) {
      return json(res, 400, {
        status: false,
        error: "prompt wajib diisi"
      });
    }

    // =========================
    // HF TOKEN
    // =========================
    const token = hfToken();

    if (!token) {
      return json(res, 500, {
        status: false,
        error: "HF_TOKEN belum dikonfigurasi"
      });
    }

    // =========================
    // HUGGING FACE
    // =========================
    const client = new InferenceClient(token);

    const image = await client.textToImage({
      model: MODEL,
      inputs: prompt,
      provider: "auto"
    });

    // =========================
    // IMAGE -> BASE64
    // =========================
    const buffer = Buffer.from(await image.arrayBuffer());
    const mime = image.type || "image/png";

    const base64 = buffer.toString("base64");

    // =========================
    // RESPONSE
    // =========================
    return json(res, 200, {
      status: true,
      model: MODEL,
      prompt,
      mime,
      image: `data:${mime};base64,${base64}`
    });

  } catch (e) {
    console.error("NOVA AI IMAGE ERROR:", e);

    return json(res, 500, {
      status: false,
      error: e?.message || "Image generation failed"
    });
  }
}
