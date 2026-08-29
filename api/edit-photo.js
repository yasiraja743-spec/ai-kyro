export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      status: false,
      error: "Method Not Allowed"
    });
  }

  try {
    let body = {};

    if (req.method === "GET") {
      body = req.query || {};
    } else {
      if (typeof req.body === "object" && req.body !== null) {
        body = req.body;
      } else {
        try {
          body = JSON.parse(req.body || "{}");
        } catch {
          body = {};
        }
      }
    }

    const imageUrl = String(
      body.url ||
      body.image ||
      body.image_url ||
      ""
    ).trim();

    const prompt = String(
      body.prompt ||
      ""
    ).trim();

    if (!imageUrl) {
      return res.status(400).json({
        status: false,
        error: "Parameter url wajib diisi"
      });
    }

    if (!prompt) {
      return res.status(400).json({
        status: false,
        error: "Parameter prompt wajib diisi"
      });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return res.status(400).json({
        status: false,
        error: "URL gambar tidak valid"
      });
    }

    // base64/data URI tidak bisa difetch oleh API pihak ketiga — foto harus
    // sudah di-upload dulu (lihat /api/upload-image) supaya jadi URL http(s).
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return res.status(400).json({
        status: false,
        error:
          "URL gambar harus berupa link http/https publik. Upload foto dulu lewat /api/upload-image untuk mendapatkan URL-nya."
      });
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
        headers: {
          "Accept": "application/json,image/*,*/*"
        },
        signal: controller.signal
      });
    } catch (fetchError) {
      return res.status(504).json({
        status: false,
        error: "Gagal menghubungi API edit foto (timeout/network error)",
        detail: fetchError?.message || String(fetchError)
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text().catch(() => "");

      return res.status(502).json({
        status: false,
        error: "API Ikyyxd gagal",
        upstream_status: apiResponse.status,
        detail: errorText.slice(0, 2000)
      });
    }

    const contentType =
      apiResponse.headers.get("content-type") || "";

    if (contentType.includes("image/")) {
      const imageBuffer = Buffer.from(
        await apiResponse.arrayBuffer()
      );

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", imageBuffer.length.toString());
      res.setHeader("Cache-Control", "no-store");

      return res.status(200).send(imageBuffer);
    }

    const raw = await apiResponse.text();

    let resultUrl = null;

    try {
      const data = JSON.parse(raw);

      resultUrl =
        data?.url ||
        data?.result ||
        data?.image ||
        data?.image_url ||
        data?.output ||
        data?.output_url ||
        data?.data?.url ||
        data?.data?.result ||
        data?.data?.image ||
        data?.data?.image_url ||
        data?.data?.output ||
        data?.data?.output_url ||
        data?.result?.url ||
        data?.result?.image ||
        data?.result?.result_url ||
        data?.result?.output_url ||
        null;

      if (Array.isArray(data?.images)) {
        resultUrl = resultUrl || data.images[0];
      }

      if (Array.isArray(data?.data)) {
        resultUrl = resultUrl || data.data[0];
      }

      if (Array.isArray(data?.result)) {
        resultUrl = resultUrl || data.result[0];
      }

    } catch {
      const urlMatch = raw.match(/https?:\/\/[^\s"'<>]+/i);

      if (urlMatch) {
        resultUrl = urlMatch[0];
      }
    }

    if (typeof resultUrl === "object" && resultUrl !== null) {
      resultUrl =
        resultUrl.url ||
        resultUrl.image ||
        resultUrl.image_url ||
        resultUrl.output_url ||
        resultUrl.result_url ||
        null;
    }

    if (!resultUrl || typeof resultUrl !== "string") {
      return res.status(502).json({
        status: false,
        error: "URL hasil gambar tidak ditemukan",
        upstream_response: raw.slice(0, 5000)
      });
    }

    if (resultUrl.startsWith("data:image/")) {
      const match = resultUrl.match(/^data:(image\/[^;]+);base64,(.+)$/s);

      if (!match) {
        return res.status(502).json({
          status: false,
          error: "Format data:image tidak valid"
        });
      }

      const buffer = Buffer.from(match[2], "base64");

      res.setHeader("Content-Type", match[1]);
      res.setHeader("Content-Length", buffer.length.toString());
      res.setHeader("Cache-Control", "no-store");

      return res.status(200).send(buffer);
    }

    try {
      new URL(resultUrl);
    } catch {
      return res.status(502).json({
        status: false,
        error: "URL hasil gambar tidak valid",
        result: resultUrl
      });
    }

    const imageResponse = await fetch(resultUrl, {
      method: "GET",
      headers: {
        "Accept": "image/*,*/*"
      }
    });

    if (!imageResponse.ok) {
      return res.status(502).json({
        status: false,
        error: "Gagal mengambil gambar hasil",
        image_status: imageResponse.status,
        result_url: resultUrl
      });
    }

    const outputBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const outputType =
      imageResponse.headers.get("content-type") || "image/webp";

    res.setHeader("Content-Type", outputType);
    res.setHeader("Content-Length", outputBuffer.length.toString());
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error("EDIT PHOTO ERROR:", error);

    return res.status(500).json({
      status: false,
      error: "Internal Server Error",
      detail: error?.message || String(error)
    });
  }
}
