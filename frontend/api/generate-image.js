export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      status: false,
      error: "Method Not Allowed"
    });
  }

  try {
    const body = req.body || {};
    const prompt = String(body.prompt || "").trim();

    if (!prompt) {
      return res.status(400).json({
        status: false,
        error: "prompt wajib diisi"
      });
    }

    const url =
      "https://image.pollinations.ai/prompt/" +
      encodeURIComponent(prompt) +
      "?width=768&height=768&nologo=true&enhance=true";

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");

      return res.status(response.status).json({
        status: false,
        error: `Pollinations HTTP ${response.status}`,
        detail: errorText.slice(0, 500)
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const mime =
      response.headers.get("content-type") || "image/jpeg";

    res.statusCode = 200;
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");

    return res.end(buffer);

  } catch (error) {
    console.error("Generate image error:", error);

    return res.status(500).json({
      status: false,
      error: error.message || "Image generation failed"
    });
  }
}
