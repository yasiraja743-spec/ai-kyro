import { InferenceClient } from "@huggingface/inference";
import { hfToken, json, methodPost, parseJson } from "./_hf.js";

const MODEL = "Qwen/Qwen-Image-2512";

export default async function handler(req, res) {
  if (!methodPost(req, res)) return;

  try {
    const body = await parseJson(req);
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return json(res, 400, { status: false, error: "prompt wajib diisi" });

    const client = new InferenceClient(hfToken());
    const image = await client.textToImage({
      model: MODEL,
      inputs: prompt,
      provider: "auto"
    });

    const buffer = Buffer.from(await image.arrayBuffer());
    const mime = image.type || "image/png";

    return json(res, 200, {
      status: true,
      image: `data:${mime};base64,${buffer.toString("base64")}`
    });
  } catch (e) {
    return json(res, 500, {
      status: false,
      error: e.message || "Image generation failed"
    });
  }
}
