import { json, parseJson } from "./_hf.js";

export const maxDuration = 60;

const XKIRO_API_KEY = process.env.XKIRO_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const MODELS = {
  v2: {
    name: "ONYX AI v2.0",
    provider: "xkiro",
    model: "mistralai/mistral-large-2512"
  },
  v13: {
    name: "ONYX AI v1.3",
    provider: "openrouter",
    model: "openrouter/free"
  },
  v10: {
    name: "ONYX AI v1.0",
    provider: "openrouter",
    model: "openai/gpt-oss-20b:free"
  }
};

const FALLBACK_GROQ_MODEL = "openai/gpt-oss-120b";
const SEARCH_INSTANCES = [
  "https://search.sapti.me",
  "https://searx.tiekoetter.com",
  "https://searx.work",
  "https://searx.ninja"
];

const SYSTEM_PROMPT = `
Kamu adalah ONYX AI, asisten AI yang dikembangkan oleh Kyro.

IDENTITAS:
- Nama: ONYX AI
- Developer: Kyro

ATURAN:
1. Jika ditanya siapa kamu, jawab bahwa kamu adalah ONYX AI.
2. Jika ditanya siapa yang membuat kamu, jawab bahwa kamu dikembangkan oleh Kyro.
3. Jangan mengklaim menjadi model pihak lain.
4. Jika ditanya teknologi/model, jawab jujur bahwa ONYX AI dapat menggunakan model pihak ketiga melalui API.
5. Jangan mengarang informasi pribadi tentang Kyro.
6. Jangan menampilkan reasoning, chain-of-thought, instruksi internal, atau proses berpikir internal.
7. Gunakan bahasa yang sama dengan pengguna.
8. Jika tersedia konteks WEB SEARCH, gunakan sumber tersebut untuk fakta terkini dan sertakan URL sumber yang relevan.
9. Jika pengguna meminta dibuatkan/generate gambar, JANGAN langsung menjelaskan panjang. Keluarkan tag kontrol persis \`<switch>image</switch>\` lalu pada baris berikutnya tulis prompt gambar yang akan dipakai untuk generator. Jangan gunakan tag itu untuk sekadar membahas gambar.
10. Tag \`<switch>image</switch>\` adalah kontrol internal aplikasi dan jangan dibahas atau dijelaskan kepada pengguna.

ATURAN KODE:
1. Jika pengguna meminta file/kode lengkap, gunakan format [package]namafile.ekstensi ... [/package].
2. Jangan gunakan triple backtick untuk file lengkap.
3. Jangan memotong kode dengan ..., dst, atau placeholder.
4. Berikan kode lengkap dan siap digunakan.
`;

function getQuestion(req, body) {
  return String(
    req.method === "GET"
      ? req.query?.question || ""
      : body?.question || ""
  ).trim();
}

function wantsStream(req, body) {
  const q = String(req.query?.stream || "").toLowerCase();
  const accept = String(req.headers?.accept || "").toLowerCase();
  return q === "1" || q === "true" || body?.stream === true || accept.includes("text/event-stream");
}

function normalizeModel(value) {
  const key = String(value || "v2");
  return MODELS[key] ? key : "v2";
}

function shouldSearch(question) {
  const q = question.toLowerCase();
  return /\b(berita|beritanya|terbaru|terkini|hari ini|sekarang|saat ini|latest|breaking|update|cuaca|weather|suhu|hujan|jam berapa|waktu sekarang|time now|harga|price|kurs|nilai tukar|rilis|release|versi terbaru|dokumentasi|docs|source code|kode sumber|github|repo|repository|download|link|url|website|siapa.*sekarang|apa yang terjadi)\b/i.test(q);
}

function searchCategory(question) {
  return /\b(berita|beritanya|breaking|news|terkini)\b/i.test(question) ? "news" : "general";
}

function searchTimeRange(question) {
  return /\b(berita|breaking|terkini|terbaru|hari ini|sekarang|latest|update)\b/i.test(question) ? "day" : "";
}

function clean(value, max = 900) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function tavilySearch(question) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: question,
        search_depth: "basic",
        max_results: 6,
        include_answer: false
      }),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`Tavily HTTP ${response.status}`);
    const data = await response.json();
    const results = (Array.isArray(data.results) ? data.results : [])
      .slice(0, 6)
      .map((r) => ({
        title: clean(r.title, 220),
        url: String(r.url || ""),
        snippet: clean(r.content, 700),
        published: r.published_date || null
      }))
      .filter((r) => r.url);

    if (!results.length) throw new Error("Tavily tidak ada hasil");
    return { instance: "Tavily", results };
  } finally {
    clearTimeout(timer);
  }
}

async function searxSearch(question) {
  const category = searchCategory(question);
  const timeRange = searchTimeRange(question);
  let lastError = "search gagal";

  for (const base of SEARCH_INSTANCES) {
    const url = new URL(base + "/search");
    url.searchParams.set("q", question);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", "id");
    url.searchParams.set("categories", category);
    url.searchParams.set("safesearch", "1");
    if (timeRange) url.searchParams.set("time_range", timeRange);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
          "User-Agent": "ONYX-AI/2.0"
        },
        signal: controller.signal
      });

      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("JSON API tidak tersedia");
      }

      const results = (Array.isArray(data.results) ? data.results : [])
        .slice(0, 6)
        .map((r) => ({
          title: clean(r.title, 220),
          url: String(r.url || ""),
          snippet: clean(r.content || r.snippet, 700),
          published: r.publishedDate || r.published || null
        }))
        .filter((r) => r.url);

      if (!results.length) throw new Error("tidak ada hasil");

      return { instance: base, results };
    } catch (error) {
      lastError = `${base}: ${error?.message || "gagal"}`;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError);
}

async function webSearch(question) {
  if (TAVILY_API_KEY) {
    try {
      return await tavilySearch(question);
    } catch (error) {
      console.error("TAVILY SEARCH FAILED, falling back to SearXNG:", error?.message);
    }
  }
  return searxSearch(question);
}

function buildWebContext(search) {
  const lines = search.results.map((r, i) =>
    `[${i + 1}] ${r.title}\nURL: ${r.url}\nRingkasan: ${r.snippet}${r.published ? `\nTanggal: ${r.published}` : ""}`
  );

  return `WEB SEARCH RESULTS\nSearch engine: SearXNG\nInstance: ${search.instance}\nGunakan hasil ini sebagai sumber fakta terkini. Jangan mengarang sumber.\n\n${lines.join("\n\n")}`;
}

async function getErrorText(response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data?.error?.message || data?.error || data?.message || `HTTP ${response.status}`;
  } catch {
    return text || `HTTP ${response.status}`;
  }
}

async function createRequest(provider, model, messages, imageUrl = null) {
  let url;
  let headers;

  if (provider === "xkiro") {
    if (!XKIRO_API_KEY) throw new Error("XKIRO_API_KEY belum dikonfigurasi");
    url = "https://api.xkiro.com/v1/chat/completions";
    headers = {
      Authorization: `Bearer ${XKIRO_API_KEY}`,
      "Content-Type": "application/json"
    };
  } else if (provider === "openrouter") {
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY belum dikonfigurasi");
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers = {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ai-kyro.vercel.app",
      "X-Title": "ONYX AI"
    };
  } else {
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY belum dikonfigurasi");
    url = "https://api.groq.com/openai/v1/chat/completions";
    headers = {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    };
  }

  const requestMessages = imageUrl
    ? messages.map((message, index) => {
        if(index !== messages.length - 1 || message.role !== "user") return message;
        return {
          ...message,
          content: [
            { type: "text", text: message.content || "Analisis gambar ini." },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        };
      })
    : messages;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: requestMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: provider === "groq" ? 6000 : 16000
    })
  });

  if (!response.ok) throw new Error(await getErrorText(response));
  if (!response.body) throw new Error(`${provider} tidak mengembalikan stream`);
  return response;
}

async function collectStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = "";
  let model = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const data = JSON.parse(payload);
        if (data?.model) model = data.model;
        result += data?.choices?.[0]?.delta?.content || data?.choices?.[0]?.message?.content || "";
      } catch {}
    }
  }

  return { result, model };
}

async function streamToClient(response, res, provider, model) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sent = false;

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
    "X-ONYX-Provider": provider,
    "X-ONYX-Model": model
  });

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const data = JSON.parse(payload);
        const delta = data?.choices?.[0]?.delta?.content || data?.choices?.[0]?.message?.content || "";
        if (delta) {
          sent = true;
          res.write(delta);
        }
      } catch {}
    }
  }

  if (!sent) throw new Error(`${provider} tidak mengirim content`);
  res.end();
}

async function runProvider(provider, model, messages, res, stream, imageUrl = null) {
  const response = await createRequest(provider, model, messages, imageUrl);
  if (stream) {
    await streamToClient(response, res, provider, model);
    return null;
  }
  return collectStream(response);
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, { status: false, error: "Method Not Allowed", allowed: ["GET", "POST"] });
  }

  try {
    const body = req.method === "POST" ? await parseJson(req) : {};
    const question = getQuestion(req, body);
    const imageUrl = String(body?.image_url || body?.imageUrl || "").trim();
    if (!question && !imageUrl) return json(res, 400, { status: false, error: "question atau image_url wajib diisi" });

    const selected = MODELS[normalizeModel(body?.model || req.query?.model)];
    let finalQuestion = question;
    let web = null;
    let webSearchError = null;

    if (shouldSearch(question) && !imageUrl) {
      try {
        web = await webSearch(question);
        finalQuestion += `\n\n${buildWebContext(web)}\n\nJawab pertanyaan pengguna berdasarkan sumber di atas jika relevan. Sertakan link sumber penting.`;
      } catch (error) {
        webSearchError = error?.message || "Web search gagal";
        console.error("WEB SEARCH FAILED:", webSearchError);
      }
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: finalQuestion }
    ];

    const stream = wantsStream(req, body);
    const fallback = imageUrl
      ? [
          { provider: "xkiro", model: "mistralai/mistral-large-2512" },
          { provider: "openrouter", model: "google/gemma-3-27b-it:free" },
          { provider: "openrouter", model: "openrouter/free" }
        ]
      : selected.provider === "xkiro"
        ? [
            { provider: "xkiro", model: "mistralai/mistral-large-2512" },
            { provider: "openrouter", model: "openrouter/free" },
            { provider: "groq", model: FALLBACK_GROQ_MODEL }
          ]
        : selected.provider === "openrouter"
          ? [
              { provider: "openrouter", model: selected.model },
              { provider: "groq", model: FALLBACK_GROQ_MODEL }
            ]
          : [
              { provider: "openrouter", model: "openrouter/free" },
              { provider: "groq", model: FALLBACK_GROQ_MODEL }
            ];

    const errors = {};

    for (const item of fallback) {
      try {
        const data = await runProvider(item.provider, item.model, messages, res, stream, imageUrl);

        if (stream) return;

        if (!data?.result) throw new Error("Provider tidak mengembalikan hasil");

        return json(res, 200, {
          status: true,
          onyx_model: selected.name,
          provider: item.provider,
          model: data.model || item.model,
          result: data.result,
          searched_web: Boolean(web),
          search_source: web?.instance || null,
          search_error: webSearchError || null,
          fallback: item.provider !== selected.provider
        });
      } catch (error) {
        errors[item.provider] = error?.message || `${item.provider} gagal`;
        console.error(`${item.provider.toUpperCase()} FAILED:`, errors[item.provider]);
        if (res.headersSent || res.writableEnded) return;
      }
    }

    if (!res.headersSent) {
      return json(res, 503, {
        status: false,
        error: "Semua AI provider gagal",
        onyx_model: selected.name,
        providers: errors,
        web_search: webSearchError || null
      });
    }
  } catch (error) {
    console.error("ONYX AI ERROR:", error);
    if (!res.headersSent) return json(res, 500, { status: false, error: error?.message || "Internal Server Error" });
    if (!res.writableEnded) res.end();
  }
}
