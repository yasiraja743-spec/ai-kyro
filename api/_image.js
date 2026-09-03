// Shared image helpers for ONYX AI.
// Image generation uses Pixazo REST API -> FLUX 1 Schnell (free preview).
// Pixazo credentials are read ONLY from Vercel/server environment variables.

const PIXAZO_API_KEY = process.env.PIXAZO_API_KEY;
const PIXAZO_IMAGE_ENDPOINT = "https://gateway.pixazo.ai/flux-1-schnell/v1/getData";
const PIXAZO_IMAGE_MODEL = "flux-1-schnell";

function imageError(message, status = 500, detail = "") {
  const err = new Error(message);
  err.status = status;
  if (detail) err.detail = detail;
  return err;
}

function parseDataImage(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+)(?:;charset=[^;,]+)?;base64,(.+)$/s);
  if (!match) return null;
  return { buffer: Buffer.from(match[2], "base64"), mime: match[1] };
}

function pickOutputUrl(data) {
  const candidates = [
    data?.output,
    data?.url,
    data?.image,
    data?.image_url,
    data?.result?.output,
    data?.result?.url,
    data?.result?.image,
    data?.result?.image_url,
    data?.data?.output,
    data?.data?.url,
    data?.data?.image,
    data?.data?.image_url
  ];
  for (const value of candidates) {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  }
  return null;
}

function parseAspectRatio(value) {
  const match = String(value || "1:1").match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return [512, 512];
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return [512, 512];
  const maxSide = 1024;
  if (w >= h) return [maxSide, Math.max(256, Math.round(maxSide * h / w))];
  return [Math.max(256, Math.round(maxSide * w / h)), maxSide];
}

export async function generatePixazoImage(prompt, options = {}) {
  if (!PIXAZO_API_KEY) {
    throw imageError("PIXAZO_API_KEY belum dikonfigurasi di Vercel Environment Variables", 500);
  }

  const cleanPrompt = String(prompt || "").trim();
  if (!cleanPrompt) throw imageError("prompt wajib diisi", 400);
  if (cleanPrompt.length > 2048) throw imageError("prompt maksimal 2048 karakter", 400);

  const stepsRaw = Number(options.steps ?? 4);
  const num_steps = Number.isFinite(stepsRaw) ? Math.min(8, Math.max(1, Math.round(stepsRaw))) : 4;
  const [width, height] = parseAspectRatio(options.aspect_ratio || "1:1");

  const input = {
    prompt: cleanPrompt,
    num_steps,
    seed: Math.floor(Math.random() * 2147483647),
    width,
    height
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(PIXAZO_IMAGE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Ocp-Apim-Subscription-Key": PIXAZO_API_KEY,
        Accept: "application/json"
      },
      body: JSON.stringify(input),
      signal: controller.signal
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw imageError("Pixazo mengembalikan response yang bukan JSON", 502, raw.slice(0, 3000));
    }

    if (!response.ok) {
      const detail = data?.message || data?.error || data?.detail || raw;
      throw imageError(`Pixazo API HTTP ${response.status}`, response.status, String(detail).slice(0, 4000));
    }

    const inline = parseDataImage(data?.output || data?.image || data?.result?.image);
    if (inline) return inline;

    const outputUrl = pickOutputUrl(data);
    if (!outputUrl) {
      throw imageError("Pixazo tidak mengembalikan URL hasil gambar", 502, JSON.stringify(data).slice(0, 5000));
    }

    const imageResponse = await fetch(outputUrl, { headers: { Accept: "image/*,*/*" }, signal: controller.signal });
    if (!imageResponse.ok) {
      const errorText = await imageResponse.text().catch(() => "");
      throw imageError("Gagal mengambil gambar hasil dari Pixazo", 502, errorText.slice(0, 2000));
    }

    return {
      buffer: Buffer.from(await imageResponse.arrayBuffer()),
      mime: (imageResponse.headers.get("content-type") || "image/png").split(";")[0]
    };
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw imageError("Pixazo image generation timeout", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// Backward-compatible exports used by older ONYX code.
export const generateCloudflareImage = generatePixazoImage;
export const generatePollinationsImage = generatePixazoImage;

export async function editImageWithIkyyxd(imageUrl, prompt) {
  let parsedUrl;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw imageError("URL gambar tidak valid", 400);
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw imageError(
      "URL gambar harus berupa link http/https publik. Upload foto dulu lewat /api/upload-image untuk mendapatkan URL-nya.",
      400
    );
  }

  const apiUrl =
    "https://api.ikyyxd.my.id/edit/nanobananav3" +
    "?prompt=" + encodeURIComponent(prompt) +
    "&url=" + encodeURIComponent(imageUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let apiResponse;
  try {
    apiResponse = await fetch(apiUrl, {
      method: "GET",
      headers: { Accept: "application/json,image/*,*/*" },
      signal: controller.signal
    });
  } catch (fetchError) {
    throw imageError("Gagal menghubungi API edit foto (timeout/network error)", 504, fetchError?.message || String(fetchError));
  } finally {
    clearTimeout(timeout);
  }

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text().catch(() => "");
    const err = imageError("API Ikyyxd gagal", 502, errorText.slice(0, 2000));
    err.upstream_status = apiResponse.status;
    throw err;
  }

  const contentType = apiResponse.headers.get("content-type") || "";
  if (contentType.includes("image/")) {
    return { buffer: Buffer.from(await apiResponse.arrayBuffer()), mime: contentType };
  }

  const raw = await apiResponse.text();
  let resultUrl = null;
  try {
    const data = JSON.parse(raw);
    resultUrl =
      data?.url || data?.result || data?.image || data?.image_url ||
      data?.output || data?.output_url || data?.data?.url ||
      data?.data?.result || data?.data?.image || data?.data?.image_url ||
      data?.data?.output || data?.data?.output_url || data?.result?.url ||
      data?.result?.image || data?.result?.result_url || data?.result?.output_url || null;
    if (Array.isArray(data?.images)) resultUrl ||= data.images[0];
    if (Array.isArray(data?.data)) resultUrl ||= data.data[0];
    if (Array.isArray(data?.result)) resultUrl ||= data.result[0];
  } catch {
    resultUrl = raw.match(/https?:\/\/[^\s"'<>]+/i)?.[0] || null;
  }

  if (typeof resultUrl === "object" && resultUrl !== null) {
    resultUrl = resultUrl.url || resultUrl.image || resultUrl.image_url || resultUrl.output_url || resultUrl.result_url || null;
  }

  const inline = parseDataImage(resultUrl);
  if (inline) return inline;
  if (!resultUrl || typeof resultUrl !== "string") throw imageError("URL hasil gambar tidak ditemukan", 502, raw.slice(0, 5000));
  try { new URL(resultUrl); } catch { throw imageError("URL hasil gambar tidak valid", 502, resultUrl); }

  const imageResponse = await fetch(resultUrl, { headers: { Accept: "image/*,*/*" } });
  if (!imageResponse.ok) throw imageError("Gagal mengambil gambar hasil", 502, resultUrl);
  return { buffer: Buffer.from(await imageResponse.arrayBuffer()), mime: imageResponse.headers.get("content-type") || "image/webp" };
}
