import { hfToken, json, parseJson } from "./_hf.js";
import { InferenceClient } from "@huggingface/inference";

const HF_MODEL = "Qwen/Qwen-Image-2512";

async function pollinations(prompt) {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=1024&height=1024&nologo=true`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Pollinations HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  const mime =
    response.headers.get("content-type") || "image/jpeg";

  return {
    buffer,
    mime,
    provider: "pollinations"
  };
}

async function huggingface(prompt) {
  const token = hfToken();

  if (!token) {
    throw new Error("HF_TOKEN belum dikonfigurasi");
  }

  const client = new InferenceClient(token);

  const image = await client.textToImage({
    model: HF_MODEL,
    inputs: prompt,
    provider: "auto"
  });

  const buffer = Buffer.from(await image.arrayBuffer());

  const mime =
    image.type || "image/png";

  return {
    buffer,
    mime,
    provider: "huggingface"
  };
}

export default async function handler(req, res) {
  try {
    let body = {};

    // =========================
    // GET
    // =========================
    if (req.method === "GET") {
      body = req.query || {};
    }

    // =========================
    // POST
    // =========================
    else if (req.method === "POST") {
      body = await parseJson(req);
    }

    // =========================
    // METHOD
    // =========================
    else {
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

    // =========================
    // PROVIDER 1
    // POLLINATIONS
    // =========================
    try {
      const result = await pollinations(prompt);

      return json(res, 200, {
        status: true,
        provider: result.provider,
        prompt,
        mime: result.mime,
        image: `data:${result.mime};base64,${result.buffer.toString("base64")}`
      });

    } catch (pollinationsError) {
      console.error(
        "Pollinations failed:",
        pollinationsError?.message
      );
    }

    // =========================
    // PROVIDER 2
    // HUGGING FACE
    // =========================
    try {
      const result = await huggingface(prompt);

      return json(res, 200, {
        status: true,
        provider: result.provider,
        model: HF_MODEL,
        prompt,
        mime: result.mime,
        image: `data:${result.mime};base64,${result.buffer.toString("base64")}`
      });

    } catch (hfError) {
      console.error(
        "Hugging Face failed:",
        hfError?.message
      );

      return json(res, 502, {
        status: false,
        error: "Semua image provider gagal",
        providers: {
          pollinations: "failed",
          huggingface: "failed"
        },
        details: {
          huggingface: hfError?.message || "Unknown error"
        }
      });
    }

  } catch (e) {
    console.error("NOVA AI T2I ERROR:", e);

    return json(res, 500, {
      status: false,
      error: e?.message || "Image generation failed"
    });
  }
}
