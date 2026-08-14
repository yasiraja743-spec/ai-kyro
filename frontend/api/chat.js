import { hfToken, json, methodPost, parseJson } from "./_hf.js";

const MODEL = "Qwen/Qwen2.5-VL-7B-Instruct";

export default async function handler(req, res) {
  if (!methodPost(req, res)) return;

  try {
    const body = await parseJson(req);
    const question = String(body.question || "").trim();
    if (!question) return json(res, 400, { status: false, error: "question wajib diisi" });

    const messages = body.image
      ? [{
          role: "user",
          content: [
            { type: "text", text: question },
            { type: "image_url", image_url: { url: String(body.image) } }
          ]
        }]
      : [{ role: "user", content: question }];

    const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return json(res, r.status, {
        status: false,
        error: data?.error?.message || data?.error || `Hugging Face HTTP ${r.status}`
      });
    }

    return json(res, 200, {
      status: true,
      result: data?.choices?.[0]?.message?.content || ""
    });
  } catch (e) {
    return json(res, 500, { status: false, error: e.message || "Chat failed" });
  }
}
