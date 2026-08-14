import { InferenceClient } from "@huggingface/inference";
import { hfToken, json, methodPost, parseJson } from "./_hf.js";

const MODEL = "Qwen/Qwen-Image-Edit";

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error("Format image harus berupa data URL base64.");
  const mime = match[1];
  const bytes = Buffer.from(match[2], "base64");
  return new Blob([bytes], { type: mime });
}

export default async function handler(req, res) {
  if (!methodPost(req, res)) return;

  try {
    const body = await parseJson(req);
    const prompt = String(body.prompt || "").trim();
    const image = String(body.image || "");
    if (!prompt) return json(res, 400, { status: false, error: "prompt wajib diisi" });
    if (!image) return json(res, 400, { status: false, error: "image wajib diisi" });

    const client = new InferenceClient(hfToken());
    const result = await client.imageToImage({
      model: MODEL,
      provider: "fal-ai",
      data: dataUrlToBlob(image),
      parameters: { prompt }
    });

    const buffer = Buffer.from(await result.arrayBuffer());
    const mime = result.type || "image/png";

    return json(res, 200, {
      status: true,
      image: `data:${mime};base64,${buffer.toString("base64")}`
    });
  } catch (e) {
    return json(res, 500, {
      status: false,
      error: e.message || "Image editing failed"
    });
  }
}
