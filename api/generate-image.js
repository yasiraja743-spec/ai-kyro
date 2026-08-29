export default async function handler(req, res) {
  try {
    let prompt = "";

    if (req.method === "GET") {
      prompt = String(req.query?.prompt || "").trim();
    } else if (req.method === "POST") {
      const body = req.body || {};
      prompt = String(body.prompt || "").trim();
    } else {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({
        status: false,
        error: "Method Not Allowed"
      });
    }

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

      return res.status(500).json({
        status: false,
        error: `Image provider HTTP ${response.status}`,
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

  } catch (e) {
    console.error(e);

    return res.status(500).json({
      status: false,
      error: e.message || "Image generation failed"
    });
  }
}
