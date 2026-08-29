const INSTANCES = [
  "https://search.sapti.me",
  "https://searx.tiekoetter.com",
  "https://searx.work",
  "https://searx.ninja"
];

function cleanText(value, max = 700) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ status: false, error: "Method Not Allowed" });
  }

  let q = req.query?.q || req.query?.query || "";
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      q = body.q || body.query || q;
    } catch {}
  }

  q = String(q).trim();
  if (!q) return res.status(400).json({ status: false, error: "q wajib diisi" });

  const category = String(req.query?.category || "general");
  const timeRange = req.query?.time_range ? String(req.query.time_range) : "";

  let lastError = "Semua SearXNG instance gagal";

  for (const base of INSTANCES) {
    const url = new URL(base + "/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", "id");
    url.searchParams.set("categories", category);
    url.searchParams.set("safesearch", "1");
    if (["day", "month", "year"].includes(timeRange)) url.searchParams.set("time_range", timeRange);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
          "User-Agent": "NOVA-AI/2.0 WebSearch"
        },
        signal: controller.signal
      });

      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("instance tidak mengaktifkan JSON API");
      }

      const results = Array.isArray(data.results) ? data.results : [];
      if (!results.length) throw new Error("tidak ada hasil");

      const normalized = results.slice(0, 6).map((r) => ({
        title: cleanText(r.title, 220),
        url: String(r.url || ""),
        snippet: cleanText(r.content || r.snippet, 700),
        published: r.publishedDate || r.published || null,
        source: r.engine || null
      })).filter(r => r.url);

      return res.status(200).json({
        status: true,
        query: q,
        source: "SearXNG",
        instance: base,
        results: normalized
      });
    } catch (error) {
      lastError = `${base}: ${error?.message || "gagal"}`;
    } finally {
      clearTimeout(timer);
    }
  }

  return res.status(503).json({
    status: false,
    error: "Web search gagal",
    detail: lastError
  });
}
