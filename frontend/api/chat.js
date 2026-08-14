import { hfToken, json, parseJson } from "./_hf.js";

const MODEL = "Qwen/Qwen2.5-7B-Instruct-1M";

export default async function handler(req, res) {
  try {
    // =========================
    // AMBIL DATA REQUEST
    // =========================
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

    // =========================
    // QUESTION
    // =========================
    const question = String(body.question || "").trim();

    if (!question) {
      return json(res, 400, {
        status: false,
        error: "question wajib diisi"
      });
    }

    // =========================
    // TOKEN HUGGING FACE
    // =========================
    const token = hfToken();

    if (!token) {
      return json(res, 500, {
        status: false,
        error: "HF_TOKEN belum dikonfigurasi di Vercel"
      });
    }

    // =========================
    // MESSAGE
    // =========================
    let messages;

    if (body.image) {
      messages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: question
            },
            {
              type: "image_url",
              image_url: {
                url: String(body.image)
              }
            }
          ]
        }
      ];
    } else {
      messages = [
        {
          role: "user",
          content: question
        }
      ];
    }

    // =========================
    // REQUEST KE HUGGING FACE
    // =========================
    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 2048
        })
      }
    );

    // =========================
    // PARSE RESPONSE
    // =========================
    let data;

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    // =========================
    // ERROR HUGGING FACE
    // =========================
    if (!response.ok) {
      return json(res, response.status, {
        status: false,
        error:
          data?.error?.message ||
          data?.error ||
          `Hugging Face HTTP ${response.status}`,
        huggingface_status: response.status
      });
    }

    // =========================
    // AMBIL HASIL
    // =========================
    const result =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      "";

    if (!result) {
      return json(res, 502, {
        status: false,
        error: "Hugging Face tidak mengembalikan hasil",
        response: data
      });
    }

    // =========================
    // RESPONSE BERHASIL
    // =========================
    return json(res, 200, {
      status: true,
      model: MODEL,
      result
    });

  } catch (error) {
    console.error("NOVA AI CHAT ERROR:", error);

    return json(res, 500, {
      status: false,
      error: error?.message || "Internal Server Error"
    });
  }
}
