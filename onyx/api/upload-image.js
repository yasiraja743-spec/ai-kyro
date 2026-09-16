export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      status: false,
      error: "Method Not Allowed"
    });
  }

  try {
    const contentType =
      req.headers["content-type"] || "";

    if (!contentType.startsWith("image/")) {
      return res.status(400).json({
        status: false,
        error: "Kirim file gambar langsung dengan Content-Type image/*"
      });
    }

    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    if (!buffer.length) {
      return res.status(400).json({
        status: false,
        error: "File gambar kosong"
      });
    }

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(413).json({
        status: false,
        error: "Ukuran gambar maksimal 10MB"
      });
    }

    const ext =
      contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
        ? "webp"
        : contentType === "image/gif"
        ? "gif"
        : "jpg";

    const filename = `upload-${Date.now()}.${ext}`;

    const form = new FormData();
    form.append(
      "file",
      new Blob([buffer], { type: contentType }),
      filename
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let uploadResponse;

    try {
      uploadResponse = await fetch("https://api.nexray.eu.cc/upload", {
        method: "POST",
        body: form,
        signal: controller.signal
      });
    } catch (fetchError) {
      return res.status(504).json({
        status: false,
        error: "Gagal menghubungi layanan upload (timeout/network error)",
        detail: fetchError?.message || String(fetchError)
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await uploadResponse.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        status: false,
        error: "Respon layanan upload bukan JSON valid",
        detail: raw.slice(0, 1000)
      });
    }

    if (!uploadResponse.ok || data?.status === false || data?.result?.success === false) {
      return res.status(502).json({
        status: false,
        error: "Layanan upload gagal memproses gambar",
        upstream_status: uploadResponse.status,
        detail: data
      });
    }

    const publicUrl =
      data?.result?.url ||
      data?.url ||
      null;

    if (!publicUrl) {
      return res.status(502).json({
        status: false,
        error: "URL hasil upload tidak ditemukan",
        detail: data
      });
    }

    return res.status(200).json({
      status: true,
      url: publicUrl,
      filename: data?.result?.filename || filename,
      content_type: data?.result?.mimeType || contentType,
      size: data?.result?.size || buffer.length
    });

  } catch (error) {
    console.error("UPLOAD IMAGE ERROR:", error);

    return res.status(500).json({
      status: false,
      error: "Gagal upload gambar",
      detail: error?.message || String(error)
    });
  }
}
