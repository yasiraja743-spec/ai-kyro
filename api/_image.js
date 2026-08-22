// Helper bersama untuk generate & edit gambar.
// Dipakai oleh api/chat.js (auto-routing) DAN api/generate-image.js / api/edit-photo.js
// (endpoint langsung, tetap dipertahankan buat yang integrasi API manual — lihat api-docs.html).

export async function generatePollinationsImage(prompt) {
  const url =
    "https://image.pollinations.ai/prompt/" +
    encodeURIComponent(prompt) +
    "?width=768&height=768&nologo=true&enhance=true";

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const err = new Error(`Image provider HTTP ${response.status}`);
    err.detail = errorText.slice(0, 500);
    throw err;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mime = response.headers.get("content-type") || "image/jpeg";

  return { buffer, mime };
}

export async function editImageWithIkyyxd(imageUrl, prompt) {
  let parsedUrl;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    const err = new Error("URL gambar tidak valid");
    err.status = 400;
    throw err;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    const err = new Error(
      "URL gambar harus berupa link http/https publik. Upload foto dulu lewat /api/upload-image untuk mendapatkan URL-nya."
    );
    err.status = 400;
    throw err;
  }

  const apiUrl =
    "https://api.ikyyxd.my.id/edit/nanobananav3" +
    "?prompt=" +
    encodeURIComponent(prompt) +
    "&url=" +
    encodeURIComponent(imageUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let apiResponse;

  try {
    apiResponse = await fetch(apiUrl, {
      method: "GET",
      headers: { "Accept": "application/json,image/*,*/*" },
      signal: controller.signal
    });
  } catch (fetchError) {
    const err = new Error("Gagal menghubungi API edit foto (timeout/network error)");
    err.status = 504;
    err.detail = fetchError?.message || String(fetchError);
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text().catch(() => "");
    const err = new Error("API Ikyyxd gagal");
    err.status = 502;
    err.upstream_status = apiResponse.status;
    err.detail = errorText.slice(0, 2000);
    throw err;
  }

  const contentType = apiResponse.headers.get("content-type") || "";

  if (contentType.includes("image/")) {
    const buffer = Buffer.from(await apiResponse.arrayBuffer());
    return { buffer, mime: contentType };
  }

  const raw = await apiResponse.text();

  let resultUrl = null;

  try {
    const data = JSON.parse(raw);

    resultUrl =
      data?.url || data?.result || data?.image || data?.image_url ||
      data?.output || data?.output_url ||
      data?.data?.url || data?.data?.result || data?.data?.image ||
      data?.data?.image_url || data?.data?.output || data?.data?.output_url ||
      data?.result?.url || data?.result?.image ||
      data?.result?.result_url || data?.result?.output_url ||
      null;

    if (Array.isArray(data?.images)) resultUrl = resultUrl || data.images[0];
    if (Array.isArray(data?.data)) resultUrl = resultUrl || data.data[0];
    if (Array.isArray(data?.result)) resultUrl = resultUrl || data.result[0];
  } catch {
    const urlMatch = raw.match(/https?:\/\/[^\s"'<>]+/i);
    if (urlMatch) resultUrl = urlMatch[0];
  }

  if (typeof resultUrl === "object" && resultUrl !== null) {
    resultUrl =
      resultUrl.url || resultUrl.image || resultUrl.image_url ||
      resultUrl.output_url || resultUrl.result_url || null;
  }

  if (!resultUrl || typeof resultUrl !== "string") {
    const err = new Error("URL hasil gambar tidak ditemukan");
    err.status = 502;
    err.detail = raw.slice(0, 5000);
    throw err;
  }

  if (resultUrl.startsWith("data:image/")) {
    const match = resultUrl.match(/^data:(image\/[^;]+);base64,(.+)$/s);
    if (!match) {
      const err = new Error("Format data:image tidak valid");
      err.status = 502;
      throw err;
    }
    return { buffer: Buffer.from(match[2], "base64"), mime: match[1] };
  }

  try {
    new URL(resultUrl);
  } catch {
    const err = new Error("URL hasil gambar tidak valid");
    err.status = 502;
    err.detail = resultUrl;
    throw err;
  }

  const imageResponse = await fetch(resultUrl, {
    method: "GET",
    headers: { "Accept": "image/*,*/*" }
  });

  if (!imageResponse.ok) {
    const err = new Error("Gagal mengambil gambar hasil");
    err.status = 502;
    err.detail = resultUrl;
    throw err;
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const mime = imageResponse.headers.get("content-type") || "image/webp";

  return { buffer, mime };
}
