import { json } from "./_hf.js";

export default async function handler(req, res) {
  return json(res, 200, {
    status: true,
    service: "ONYX AI Vercel API",
    models: {
      chatVision: "mistralai/mistral-large-2512",
      textToImage: "flux-1-schnell (Pixazo)",
      imageEdit: "Ikyyxd nanobananav3"
    },
    pixazoConfigured: Boolean(process.env.PIXAZO_API_KEY),
    xkiroConfigured: Boolean(process.env.XKIRO_API_KEY)
  });
}
