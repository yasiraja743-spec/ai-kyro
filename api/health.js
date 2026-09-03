import { json } from "./_hf.js";

export default async function handler(req, res) {
  return json(res, 200, {
    status: true,
    service: "ONYX AI Vercel API",
    models: {
      chatVision: "mistralai/mistral-large-2512",
      textToImage: "xai/grok-imagine-image-2.0",
      imageEdit: "Ikyyxd nanobananav3"
    },
    cloudflareConfigured: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
    xkiroConfigured: Boolean(process.env.XKIRO_API_KEY)
  });
}
