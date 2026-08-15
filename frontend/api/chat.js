import { json, parseJson } from "./_hf.js";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const OPENROUTER_MODEL = "openrouter/free";
const GROQ_MODEL = "openai/gpt-oss-120b";

const REQUEST_TIMEOUT = 8000;
const MAX_TOKENS = 12288;

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
5. Jangan memasukkan reasoning ke dalam package.
6. Jangan memotong kode dengan "...", "dst", atau placeholder.
7. Berikan kode lengkap dan siap digunakan.
8. Jangan berhenti di tengah kode.
9. Jika pengguna meminta website HTML lengkap tanpa menentukan file terpisah, utamakan satu [package]index.html yang berisi HTML, CSS, dan JavaScript.
10. Jangan memasukkan [package] atau [/package] ke dalam kode file itu sendiri.
11. Output yang terlihat pengguna harus hanya jawaban final.

Jangan pernah menampilkan proses berpikir internal.
`;

function timeoutSignal(ms) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, ms);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text
    };
  }
}

async function requestOpenRouter(messages) {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY belum dikonfigurasi"
    );
  }

  const timeout = timeoutSignal(REQUEST_TIMEOUT);

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        signal: timeout.signal,
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ai-kyro.vercel.app",
          "X-Title": "NOVA AI"
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: MAX_TOKENS
        })
      }
    );

    const data = await parseResponse(response);

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        data?.error ||
        data?.raw ||
        `OpenRouter HTTP ${response.status}`
      );
    }

    const result =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      "";

    if (!result) {
      throw new Error(
        "OpenRouter tidak mengembalikan hasil"
      );
    }

    return {
      result,
      provider: "openrouter",
      model: data?.model || OPENROUTER_MODEL
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        `OpenRouter timeout setelah ${REQUEST_TIMEOUT}ms`
      );
    }

    throw error;
  } finally {
    timeout.clear();
  }
}

async function requestGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY belum dikonfigurasi"
    );
  }

  const timeout = timeoutSignal(REQUEST_TIMEOUT);

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        signal: timeout.signal,
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: MAX_TOKENS
        })
      }
    );

    const data = await parseResponse(response);

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        data?.error ||
        data?.raw ||
        `Groq HTTP ${response.status}`
      );
    }

    const result =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      "";

    if (!result) {
      throw new Error(
        "Groq tidak mengembalikan hasil"
      );
    }

    return {
      result,
      provider: "groq",
      model: data?.model || GROQ_MODEL
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        `Groq timeout setelah ${REQUEST_TIMEOUT}ms`
      );
    }

    throw error;
  } finally {
    timeout.clear();
  }
}

export default async function handler(req, res) {
  try {
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

    const question = String(
      body.question || ""
    ).trim();

    if (!question) {
      return json(res, 400, {
        status: false,
        error: "question wajib diisi"
      });
    }

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

    let openRouterError = null;

    try {
      const result =
        await requestOpenRouter(messages);

      return json(res, 200, {
        status: true,
        provider: result.provider,
        model: result.model,
        result: result.result
      });
    } catch (error) {
      openRouterError =
        error?.message ||
        "OpenRouter gagal";

      console.error(
        "OPENROUTER FAILED:",
        openRouterError
      );
    }

    let groqError = null;

    try {
      const result =
        await requestGroq(messages);

      return json(res, 200, {
        status: true,
        provider: result.provider,
        model: result.model,
        result: result.result,
        fallback: true,
        fallback_from: "openrouter"
      });
    } catch (error) {
      groqError =
        error?.message ||
        "Groq gagal";

      console.error(
        "GROQ FAILED:",
        groqError
      );
    }

    return json(res, 503, {
      status: false,
      error: "Semua AI provider gagal",
      providers: {
        openrouter: openRouterError,
        groq: groqError
      }
    });

  } catch (error) {
    console.error(
      "NOVA AI ERROR:",
      error
    );

    return json(res, 500, {
      status: false,
      error:
        error?.message ||
        "Internal Server Error"
    });
  }
}
