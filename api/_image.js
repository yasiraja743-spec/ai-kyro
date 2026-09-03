// Shared image helpers for ONYX AI.
// Image generation uses Cloudflare Workers AI -> xai/grok-imagine-image-2.0.
// Cloudflare credentials are read ONLY from Vercel/server environment variables.

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_IMAGE_MODEL = "xai/grok-imagine-image-2.0";

function imageError(message, status = 500, detail = "") {
  const err = new Error(message);
  err.status = status;
  if (detail) err.detail = detail;
  return err;
}

function parseDataImage(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) return null;
  return {
    buffer: Buffer.from(match[2], "base64"),
    mime: match[1]
  };
}

export async function generateCloudflareImage(prompt, options = {}) {
  if (!CLOUDFLARE_ACCOUNT_ID) {
    throw imageError("CLOUDFLARE_ACCOUNT_ID belum dikonfigurasi di Vercel Environment Variables", 500);
  }
  if (!CLOUDFLARE_API_TOKEN) {
    throw imageError("CLOUDFLARE_API_TOKEN belum dikonfigurasi di Vercel Environment Variables", 500);
  }

  const input = {
    prompt: String(prompt || "").trim(),
    response_format: "url"
  };

  // Keep these optional so the endpoint stays compatible with the old API.
  if (options.aspect_ratio) input.aspect_ratio = options.aspect_ratio;
  if (options.quality) input.quality = options.quality;
  if (options.resolution) input.resolution = options.resolution;
  if (options.user) input.user = String(options.user).slice(0, 128);

  if (!input.prompt) throw imageError("prompt wajib diisi", 400);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(CLOUDFLARE_ACCOUNT_ID)}/ai/run`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          model: CLOUDFLARE_IMAGE_MODEL,
          input
        }),
        signal: controller.signal
      }
    );

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw imageError("Cloudflare mengembalikan response yang bukan JSON", 502, raw.slice(0, 2000));
    }

    if (!response.ok || data?.success === false) {
      const detail = Array.isArray(data?.errors)
        ? data.errors.map((e) => e?.message || JSON.stringify(e)).join("; ")
        : data?.errors || data?.error || data?.message || raw;
      throw imageError(`Cloudflare AI HTTP ${response.status}`, 502, String(detail).slice(0, 4000));
    }

    const imageValue =
      data?.result?.image ||
      data?.result?.images?.[0]?.image ||
      data?.result?.images?.[0] ||
      data?.image ||
      data?.result?.url ||
      null;

    const dataImage = parseDataImage(imageValue);
    if (dataImage) return dataImage;

    if (typeof imageValue !== "string") {
      throw imageError("Cloudflare tidak mengembalikan hasil gambar", 502, JSON.stringify(data).slice(0, 5000));
    }

    let resultUrl;
    try {
      resultUrl = new URL(imageValue);
    } catch {
      throw imageError("URL hasil gambar dari Cloudflare tidak valid", 502, imageValue.slice(0, 1000));
    }

    if (resultUrl.protocol !== "http:" && resultUrl.protocol !== "https:") {
      throw imageError("URL hasil gambar dari Cloudflare harus http/https", 502);
    }

    const imageResponse = await fetch(resultUrl, {
      headers: { Accept: "image/*,*/*" },
      signal: AbortSignal.timeout(60000)
    });

    if (!imageResponse.ok) {
      throw imageError(`Gagal mengambil hasil gambar Cloudflare HTTP ${imageResponse.status}`, 502);
    }

    return {
      buffer: Buffer.from(await imageResponse.arrayBuffer()),
      mime: imageResponse.headers.get("content-type") || "image/jpeg"
    };
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw imageError("Cloudflare image generation timeout", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// Backward-compatible name used by older code.
export const generatePollinationsImage = generateCloudflareImage;

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
    return {
      buffer: Buffer.from(await apiResponse.arrayBuffer()),
      mime: contentType
    };
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

  if (!resultUrl || typeof resultUrl !== "string") {
    throw imageError("URL hasil gambar tidak ditemukan", 502, raw.slice(0, 5000));
  }

  try { new URL(resultUrl); } catch {
    throw imageError("URL hasil gambar tidak valid", 502, resultUrl);
  }

  const imageResponse = await fetch(resultUrl, { headers: { Accept: "image/*,*/*" } });
  if (!imageResponse.ok) throw imageError("Gagal mengambil gambar hasil", 502, resultUrl);

  return {
    buffer: Buffer.from(await imageResponse.arrayBuffer()),
    mime: imageResponse.headers.get("content-type") || "image/webp"
  };
}
