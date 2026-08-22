import { json, parseJson } from "./_hf.js";
import { generatePollinationsImage, editImageWithIkyyxd } from "./_image.js";

export const maxDuration = 60;

const XKIRO_API_KEY = process.env.XKIRO_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const DEEPSEEK_MODEL = "qwen/qwen3.8-max";
const OPENROUTER_MODEL = "openrouter/free";
const GROQ_MODEL = "openai/gpt-oss-120b";

// dipakai kalau openrouter/free gagal analisis gambar (router kadang milih model
// yang bukan vision) — model ini konsisten free & vision-capable per Agustus 2026.
const VISION_FALLBACK_MODEL = "google/gemma-4-31b-it:free";

const SYSTEM_PROMPT = `
Kamu adalah NOVA AI, asisten AI yang dikembangkan oleh Kyro.

IDENTITAS:
- Nama: NOVA AI
- Developer: Kyro

ATURAN IDENTITAS:
1. Jika ditanya siapa kamu, jawab bahwa kamu adalah NOVA AI.
2. Jika ditanya siapa yang membuat kamu, jawab bahwa kamu dikembangkan oleh Kyro.
3. Jangan memperkenalkan diri sebagai model AI lain.
4. Jika ditanya teknologi atau model yang digunakan, jawab secara jujur bahwa NOVA AI dapat menggunakan model pihak ketiga melalui API.
5. Jangan mengarang informasi pribadi tentang Kyro.

ATURAN OUTPUT:
1. Jangan menampilkan reasoning, chain-of-thought, thinking process, analisis internal, atau instruksi internal.
2. Jangan menampilkan teks seperti "Here's a thinking process", "Analyze User Input", "Check System Instructions", "Draft Response", atau sejenisnya.
3. Jangan menjelaskan proses berpikir internal.
4. Langsung berikan jawaban final.
5. Gunakan bahasa yang sama dengan pengguna.

ATURAN FILE DAN KODE:
1. Jika pengguna meminta kode lengkap atau file, gunakan format:

[package]index.html
<!DOCTYPE html>
<html>
...
</html>
[/package]

2. Nama file harus tepat setelah [package].
3. Untuk beberapa file, gunakan package terpisah.
4. Jangan menggunakan triple backtick untuk file yang menggunakan format [package].
5. Jangan menambahkan reasoning di dalam package.
6. Jangan memotong kode dengan "...", "dst", atau placeholder.
7. Berikan kode lengkap dan siap digunakan.
8. Jangan berhenti di tengah kode.
9. Jika pengguna meminta website HTML lengkap tanpa menentukan file terpisah, utamakan satu [package]index.html yang berisi HTML, CSS, dan JavaScript sekaligus.
10. Jangan memasukkan [package] atau [/package] ke dalam kode file itu sendiri.
11. Output yang terlihat pengguna harus hanya jawaban final.

Jangan pernah menampilkan proses berpikir internal.
`;

/* =========================================================
   DETEKSI NIAT (intent) — dipakai buat auto-switch "model":
   chat biasa / generate gambar / edit gambar / web search.
   ========================================================= */

const IMAGE_GEN_RE = new RegExp(
  "(buat(?:kan)?|bikin(?:in)?|gambar(?:kan)?|lukis(?:kan)?|ciptakan|hasilkan|render)\\s+(?:aku |ku |saya )?(?:sebuah |satu )?(gambar|foto|ilustrasi|lukisan|wallpaper|logo|poster|avatar|karakter|desain)" +
  "|(gambar|foto|ilustrasi|lukisan)\\s+(tentang|dari|dengan tema|bertema)" +
  "|generate(?:\\s+an?)?\\s+image" +
  "|create\\s+(?:an?\\s+)?(image|picture|illustration|artwork)" +
  "|\\bimage of\\b|\\bpicture of\\b|\\bdraw\\s+(me|a|an)\\b",
  "i"
);

const IMAGE_EDIT_RE = new RegExp(
  "\\b(edit|ubah|ganti(?:in)?|hapus(?:kan)?|hilangkan|hilangin|tambahkan|tambahin|perbaiki|crop|potong|jadiin|jadikan|hapus background|ganti background|ganti warna|colorize|retouch)\\b" +
  "|\\b(remove|change|replace|enhance|recolor)\\b",
  "i"
);

const WEB_SEARCH_RE = new RegExp(
  "\\b(hari ini|sekarang|saat ini|terbaru|terkini|ter-update|update terbaru|terupdate|berita|kabar terbaru|harga (?:emas|bbm|minyak|saham|bitcoin|dollar|rupiah)|kurs|skor|hasil pertandingan|jadwal|siapa (?:presiden|ceo|juara|gubernur|menteri)|cuaca|ramalan cuaca|tahun ini|minggu ini|bulan ini)\\b" +
  "|\\b(current|latest|today|right now|breaking news|as of \\d{4}|this week|this year|weather|stock price|exchange rate)\\b",
  "i"
);

function detectImageGenIntent(text) {
  return !!text && IMAGE_GEN_RE.test(text);
}

function detectImageEditIntent(text) {
  return !!text && IMAGE_EDIT_RE.test(text);
}

function detectWebSearchIntent(text) {
  return !!text && WEB_SEARCH_RE.test(text);
}

function bufferToDataUrl(buffer, mime) {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function getQuestion(req, body) {
  if (req.method === "GET") {
    return String(req.query?.question || "").trim();
  }

  return String(body?.question || "").trim();
}

function getImageUrl(req, body) {
  if (req.method === "GET") {
    return String(req.query?.image_url || req.query?.imageUrl || "").trim();
  }
  return String(body?.image_url || body?.imageUrl || "").trim();
}

function isValidImageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function wantsStream(req, body) {
  const queryStream =
    String(req.query?.stream || "").toLowerCase();

  const accept =
    String(req.headers?.accept || "").toLowerCase();

  return (
    queryStream === "1" ||
    queryStream === "true" ||
    body?.stream === true ||
    accept.includes("text/event-stream")
  );
}

async function readJsonResponse(response, provider) {
  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      raw: text
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      data?.error ||
      data?.message ||
      data?.raw ||
      `${provider} HTTP ${response.status}`
    );
  }

  return data;
}

function extractContent(data) {
  return (
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.result ||
    ""
  );
}

async function createDeepSeekRequest(messages) {
  if (!XKIRO_API_KEY) {
    throw new Error("XKIRO_API_KEY belum dikonfigurasi");
  }

  const response = await fetch(
    "https://api.xkiro.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XKIRO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 30000
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      (await readJsonResponse(response, "xKiro")) &&
      `xKiro HTTP ${response.status}`
    );
  }

  if (!response.body) {
    throw new Error("xKiro tidak mengembalikan stream");
  }

  return response;
}

async function createOpenRouterVisionRequest(question, imageUrl, model) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY belum dikonfigurasi");
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ai-kyro.vercel.app",
        "X-Title": "NOVA AI"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: question || "Analisis gambar ini secara detail. Jelaskan apa yang terlihat, teks yang terbaca, objek penting, dan hal relevan lainnya."
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        temperature: 0.4,
        max_tokens: 12000
      })
    }
  );

  const data = await readJsonResponse(response, "OpenRouter Vision");
  const result = extractContent(data);
  if (!result) throw new Error("OpenRouter Vision tidak mengembalikan hasil");
  return { result, model: data?.model || model };
}

// coba model vision utama dulu, kalau gagal/hasil kosong baru fallback ke model
// vision cadangan — ini yang bikin "deteksi gambar" jadi jauh lebih reliable.
async function runVisionWithFallback(question, imageUrl) {
  try {
    return await createOpenRouterVisionRequest(question, imageUrl, OPENROUTER_MODEL);
  } catch (primaryError) {
    console.error("VISION PRIMARY FAILED, trying fallback model:", primaryError?.message || primaryError);
    try {
      return await createOpenRouterVisionRequest(question, imageUrl, VISION_FALLBACK_MODEL);
    } catch (fallbackError) {
      console.error("VISION FALLBACK FAILED:", fallbackError?.message || fallbackError);
      throw fallbackError;
    }
  }
}

function createOpenRouterRequest(messages, online) {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY belum dikonfigurasi"
    );
  }

  const body = {
    model: online ? `${OPENROUTER_MODEL}:online` : OPENROUTER_MODEL,
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 16000
  };

  if (online) {
    // plugin "web" OpenRouter — nginject hasil pencarian ke konteks sebelum model
    // menjawab. Dipakai (bukan tool-call openrouter:web_search) karena harus tetap
    // jalan meski model gratis yang dipilih openrouter/free tidak support tool-calling.
    body.plugins = [{ id: "web", max_results: 4 }];
  }

  return fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          "https://ai-kyro.vercel.app",
        "X-Title": "NOVA AI"
      },
      body: JSON.stringify(body)
    }
  ).then(async (response) => {
    if (!response.ok) {
      throw new Error(
        `OpenRouter: ${await getErrorText(response)}`
      );
    }

    if (!response.body) {
      throw new Error(
        "OpenRouter tidak mengembalikan stream"
      );
    }

    return response;
  });
}

async function createGroqRequest(messages) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY belum dikonfigurasi"
    );
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 6000
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Groq: ${await getErrorText(response)}`
    );
  }

  if (!response.body) {
    throw new Error(
      "Groq tidak mengembalikan stream"
    );
  }

  return response;
}

async function getErrorText(response) {
  const text = await response.text();

  try {
    const data = JSON.parse(text);

    return (
      data?.error?.message ||
      data?.error ||
      data?.message ||
      `HTTP ${response.status}`
    );
  } catch {
    return text || `HTTP ${response.status}`;
  }
}

async function collectStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let result = "";
  let model = null;

  while (true) {
    const { value, done } =
      await reader.read();

    if (done) break;

    buffer += decoder.decode(value, {
      stream: true
    });

    const lines = buffer.split("\n");

    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed.startsWith("data:")) {
        continue;
      }

      const payload =
        trimmed.slice(5).trim();

      if (!payload || payload === "[DONE]") {
        continue;
      }

      try {
        const data = JSON.parse(payload);

        if (data?.model) {
          model = data.model;
        }

        const delta =
          data?.choices?.[0]?.delta?.content ||
          data?.choices?.[0]?.message?.content ||
          "";

        if (delta) {
          result += delta;
        }
      } catch {}
    }
  }

  return {
    result,
    model
  };
}

async function streamProvider(response, res, provider, model) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let fullResult = "";
  let sentAny = false;

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "X-NOVA-Provider": provider,
    "X-NOVA-Model": model
  });

  while (true) {
    const { value, done } =
      await reader.read();

    if (done) break;

    buffer += decoder.decode(value, {
      stream: true
    });

    const lines = buffer.split("\n");

    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed.startsWith("data:")) {
        continue;
      }

      const payload =
        trimmed.slice(5).trim();

      if (!payload) {
        continue;
      }

      if (payload === "[DONE]") {
        continue;
      }

      let data;

      try {
        data = JSON.parse(payload);
      } catch {
        continue;
      }

      const delta =
        data?.choices?.[0]?.delta?.content ||
        data?.choices?.[0]?.message?.content ||
        "";

      if (!delta) {
        continue;
      }

      sentAny = true;
      fullResult += delta;

      res.write(delta);
    }
  }

  if (buffer.trim().startsWith("data:")) {
    const payload =
      buffer.trim().slice(5).trim();

    if (
      payload &&
      payload !== "[DONE]"
    ) {
      try {
        const data = JSON.parse(payload);

        const delta =
          data?.choices?.[0]?.delta?.content ||
          data?.choices?.[0]?.message?.content ||
          "";

        if (delta) {
          sentAny = true;
          fullResult += delta;
          res.write(delta);
        }
      } catch {}
    }
  }

  if (!sentAny) {
    throw new Error(
      `${provider} tidak mengirim content`
    );
  }

  res.end();

  return {
    result: fullResult,
    provider,
    model
  };
}

async function executeProvider(
  provider,
  messages,
  res,
  online
) {
  let response;

  if (provider === "deepseek") {
    response =
      await createDeepSeekRequest(messages);

    return streamProvider(
      response,
      res,
      "xkiro",
      DEEPSEEK_MODEL
    );
  }

  if (provider === "openrouter") {
    response =
      await createOpenRouterRequest(messages, online);

    return streamProvider(
      response,
      res,
      "openrouter",
      online ? `${OPENROUTER_MODEL}:online` : OPENROUTER_MODEL
    );
  }

  if (provider === "groq") {
    response =
      await createGroqRequest(messages);

    return streamProvider(
      response,
      res,
      "groq",
      GROQ_MODEL
    );
  }

  throw new Error(
    `Provider tidak dikenal: ${provider}`
  );
}

async function executeNonStreaming(
  provider,
  messages,
  online
) {
  let response;

  if (provider === "deepseek") {
    response =
      await createDeepSeekRequest(messages);
  } else if (provider === "openrouter") {
    response =
      await createOpenRouterRequest(messages, online);
  } else {
    response =
      await createGroqRequest(messages);
  }

  const data =
    await collectStream(response);

  const result = data.result;

  if (!result) {
    throw new Error(
      `${provider} tidak mengembalikan hasil`
    );
  }

  return {
    result,
    provider:
      provider === "deepseek"
        ? "xkiro"
        : provider,
    model:
      data.model ||
      (
        provider === "deepseek"
          ? DEEPSEEK_MODEL
          : provider === "openrouter"
            ? (online ? `${OPENROUTER_MODEL}:online` : OPENROUTER_MODEL)
            : GROQ_MODEL
      )
  };
}

export default async function handler(req, res) {
  if (
    req.method !== "GET" &&
    req.method !== "POST"
  ) {
    return json(res, 405, {
      status: false,
      error: "Method Not Allowed",
      allowed: ["GET", "POST"]
    });
  }

  try {
    let body = {};

    if (req.method === "POST") {
      body = await parseJson(req);
    }

    const question =
      getQuestion(req, body);

    const imageUrl = getImageUrl(req, body);

    if (!question && !imageUrl) {
      return json(res, 400, {
        status: false,
        error: "question atau image_url wajib diisi"
      });
    }

    if (imageUrl && !isValidImageUrl(imageUrl)) {
      return json(res, 400, {
        status: false,
        error: "image_url harus berupa URL http/https yang valid"
      });
    }

    /* ============================================================
       AUTO-ROUTING "MODEL" — Nova AI otomatis pindah ke "model"
       (backend) yang sesuai niat user, tanpa perlu mode manual:
       - ada image_url + instruksi edit  -> Nova Image Edit
       - ada image_url + lainnya         -> Nova Vision (analisis foto)
       - tanpa image_url + minta gambar  -> Nova Image Gen
       - tanpa image_url + butuh info up-to-date -> Nova Chat + web search
       - default                         -> Nova Chat biasa
       ============================================================ */

    if (imageUrl && detectImageEditIntent(question)) {
      try {
        const { buffer, mime } = await editImageWithIkyyxd(imageUrl, question);
        return json(res, 200, {
          status: true,
          type: "image",
          provider: "ikyyxd",
          model: "nova-image-edit",
          image: bufferToDataUrl(buffer, mime)
        });
      } catch (error) {
        console.error("EDIT PHOTO FAILED:", error?.message || error);
        return json(res, error.status || 503, {
          status: false,
          error: error.message || "Gagal mengedit gambar",
          detail: error.detail
        });
      }
    }

    if (imageUrl) {
      try {
        const vision = await runVisionWithFallback(question, imageUrl);
        return json(res, 200, {
          status: true,
          type: "text",
          provider: "openrouter",
          model: vision.model,
          result: vision.result,
          vision: true
        });
      } catch (error) {
        console.error("VISION FAILED:", error?.message || error);
        return json(res, 503, {
          status: false,
          error: "Gagal menganalisis gambar",
          detail: error?.message || "OpenRouter Vision gagal"
        });
      }
    }

    if (detectImageGenIntent(question)) {
      try {
        const { buffer, mime } = await generatePollinationsImage(question);
        return json(res, 200, {
          status: true,
          type: "image",
          provider: "pollinations",
          model: "nova-image-gen",
          image: bufferToDataUrl(buffer, mime)
        });
      } catch (error) {
        console.error("IMAGE GEN FAILED:", error?.message || error);
        return json(res, 503, {
          status: false,
          error: error.message || "Gagal membuat gambar",
          detail: error.detail
        });
      }
    }

    const needsSearch = detectWebSearchIntent(question);

    const messages = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      {
        role: "user",
        content: question
      }
    ];

    const stream =
      wantsStream(req, body);

    // kalau butuh info terkini, coba openrouter (web search) duluan —
    // deepseek/groq gak bisa browsing, jadi baru dicoba sebagai fallback
    // kalau openrouter gagal (jawaban tanpa data terbaru masih lebih baik
    // daripada error total).
    const providers = needsSearch
      ? ["openrouter", "deepseek", "groq"]
      : ["deepseek", "openrouter", "groq"];

    const errors = {};

    if (!stream) {
      for (const provider of providers) {
        try {
          const online = needsSearch && provider === "openrouter";

          const result =
            await executeNonStreaming(
              provider,
              messages,
              online
            );

          return json(res, 200, {
            status: true,
            type: "text",
            provider: result.provider,
            model: result.model,
            result: result.result,
            web_search: online,
            fallback:
              provider !== providers[0],
            fallback_from:
              provider !== providers[0] ? providers[0] : undefined
          });
        } catch (error) {
          errors[provider] =
            error?.message ||
            `${provider} gagal`;

          console.error(
            `${provider.toUpperCase()} FAILED:`,
            errors[provider]
          );
        }
      }

      return json(res, 503, {
        status: false,
        error: "Semua AI provider gagal",
        providers: errors
      });
    }

    for (const provider of providers) {
      try {
        const online = needsSearch && provider === "openrouter";

        await executeProvider(
          provider,
          messages,
          res,
          online
        );

        return;
      } catch (error) {
        errors[provider] =
          error?.message ||
          `${provider} gagal`;

        console.error(
          `${provider.toUpperCase()} STREAM FAILED:`,
          errors[provider]
        );

        if (
          res.headersSent ||
          res.writableEnded
        ) {
          return;
        }
      }
    }

    if (!res.headersSent) {
      return json(res, 503, {
        status: false,
        error: "Semua AI provider gagal",
        providers: errors
      });
    }
  } catch (error) {
    console.error(
      "NOVA AI ERROR:",
      error
    );

    if (!res.headersSent) {
      return json(res, 500, {
        status: false,
        error:
          error?.message ||
          "Internal Server Error"
      });
    }

    if (!res.writableEnded) {
      res.end();
    }
  }
}
