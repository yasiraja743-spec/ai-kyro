import { json } from "./_hf.js";

export default async function handler(req, res) {
  return json(res, 200, {
    status: true,
    service: "NOVA AI Vercel API",
    models: {
      chatVision: "Qwen/Qwen2.5-VL-7B-Instruct",
      textToImage: "Qwen/Qwen-Image-2512",
      imageEdit: "Qwen/Qwen-Image-Edit"
    },
    hfTokenConfigured: Boolean(process.env.HF_TOKEN)
  });
}
