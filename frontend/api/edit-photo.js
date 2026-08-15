export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      status: false,
      error: "Method Not Allowed"
    });
  }

  const API_KEY = process.env.PIXAZO_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      status: false,
      error: "PIXAZO_API_KEY belum dikonfigurasi di Vercel Environment Variables"
    });
  }

  try {
    let body = {};

    if (req.method === "GET") {
      body = req.query || {};
    } else {
      if (typeof req.body === "object") {
        body = req.body;
      } else {
        try {
          body = JSON.parse(req.body || "{}");
        } catch {
          body = {};
        }
      }
    }

    const image = String(body.image || "").trim();
    const prompt = String(body.prompt || "").trim();

    if (!image) {
      return res.status(400).json({
        status: false,
        error: "Parameter image wajib diisi"
      });
    }

    if (!prompt) {
      return res.status(400).json({
        status: false,
        error: "Parameter prompt wajib diisi"
      });
    }

    try {
      new URL(image);
    } catch {
      return res.status(400).json({
        status: false,
        error: "URL image tidak valid"
      });
    }

    const generateResponse = await fetch(
      "https://gateway.pixazo.ai/p-image/v1/p-image-edit/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Ocp-Apim-Subscription-Key": API_KEY
        },
        body: JSON.stringify({
          prompt,
          images: [image]
        })
      }
    );

    const generateText = await generateResponse.text();

    let generateData;

    try {
      generateData = JSON.parse(generateText);
    } catch {
      generateData = {
        raw: generateText
      };
    }

    if (!generateResponse.ok) {
      return res.status(generateResponse.status).json({
        status: false,
        error: "Pixazo gagal menerima request",
        pixazo_status: generateResponse.status,
        response: generateData
      });
    }

    const requestId = generateData?.request_id;

    if (!requestId) {
      return res.status(502).json({
        status: false,
        error: "Pixazo tidak mengembalikan request_id",
        response: generateData
      });
    }

    const statusUrl =
      `https://gateway.pixazo.ai/v2/requests/status/${encodeURIComponent(requestId)}`;

    const maxAttempts = 30;
    const delay = 2000;

    let resultData = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, delay));

      const statusResponse = await fetch(statusUrl, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          "Ocp-Apim-Subscription-Key": API_KEY
        }
      });

      const statusText = await statusResponse.text();

      let statusData;

      try {
        statusData = JSON.parse(statusText);
      } catch {
        statusData = {
          raw: statusText
        };
      }

      if (!statusResponse.ok) {
        return res.status(statusResponse.status).json({
          status: false,
          error: "Gagal mengecek status Pixazo",
          pixazo_status: statusResponse.status,
          response: statusData
        });
      }

      resultData = statusData;

      const currentStatus = String(
        statusData?.status || ""
      ).toUpperCase();

      if (currentStatus === "COMPLETED") {
        break;
      }

      if (
        currentStatus === "FAILED" ||
        currentStatus === "ERROR"
      ) {
        return res.status(502).json({
          status: false,
          error: "Pixazo gagal memproses gambar",
          request_id: requestId,
          pixazo_error: statusData?.error || null,
          response: statusData
        });
      }
    }

    const finalStatus = String(
      resultData?.status || ""
    ).toUpperCase();

    if (finalStatus !== "COMPLETED") {
      return res.status(504).json({
        status: false,
        error: "Waktu pemrosesan Pixazo habis",
        request_id: requestId,
        status: finalStatus || "UNKNOWN"
      });
    }

    const outputUrl =
      resultData?.output?.media_url?.[0];

    if (!outputUrl) {
      return res.status(502).json({
        status: false,
        error: "Pixazo selesai tetapi URL hasil gambar tidak ditemukan",
        request_id: requestId,
        response: resultData
      });
    }

    const imageResponse = await fetch(outputUrl);

    if (!imageResponse.ok) {
      return res.status(502).json({
        status: false,
        error: "Gagal mengambil gambar hasil dari Pixazo",
        http_status: imageResponse.status
      });
    }

    const contentType =
      imageResponse.headers.get("content-type") ||
      resultData?.output?.media_type ||
      "image/jpeg";

    const buffer = Buffer.from(
      await imageResponse.arrayBuffer()
    );

    res.setHeader(
      "Content-Type",
      contentType
    );

    res.setHeader(
      "Content-Length",
      buffer.length.toString()
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res.status(200).send(buffer);

  } catch (error) {
    console.error("EDIT PHOTO ERROR:", error);

    return res.status(500).json({
      status: false,
      error: "Internal Server Error",
      detail: error?.message || String(error)
    });
  }
}
