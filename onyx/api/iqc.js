// IQC (iPhone Quote Chat) image generator.
// Pure SVG: no native canvas dependency, so it is reliable on Vercel serverless.

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text, maxChars = 34) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    // Break very long words instead of letting them overflow the bubble.
    if (word.length > maxChars) {
      if (current) { lines.push(current); current = ""; }
      for (let i = 0; i < word.length; i += maxChars) lines.push(word.slice(i, i + maxChars));
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function defaultTimeString() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return `${String(wib.getUTCHours()).padStart(2, "0")}:${String(wib.getUTCMinutes()).padStart(2, "0")}`;
}

function batterySvg(x, y, pct) {
  const fill = Math.max(0, Math.min(100, pct));
  const fillW = 21 * fill / 100;
  const fillColor = fill <= 20 ? "#ff453a" : "#ffffff";
  return `
    <rect x="${x}" y="${y}" width="25" height="12" rx="3" fill="none" stroke="#fff" stroke-width="1.2"/>
    <rect x="${x + 26.5}" y="${y + 4}" width="2" height="4" rx="1" fill="#fff"/>
    <rect x="${x + 2}" y="${y + 2}" width="${fillW}" height="8" rx="1.5" fill="${fillColor}"/>`;
}

function signalSvg(x, y) {
  return [4, 7, 10, 13].map((h, i) =>
    `<rect x="${x + i * 6}" y="${y + (13 - h)}" width="4" height="${h}" rx="1" fill="#fff"/>`
  ).join("");
}

function wifiSvg(x, y) {
  return `<g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round">
    <path d="M ${x - 8} ${y - 2} Q ${x} ${y - 10} ${x + 8} ${y - 2}"/>
    <path d="M ${x - 5} ${y + 1} Q ${x} ${y - 5} ${x + 5} ${y + 1}"/>
    <circle cx="${x}" cy="${y + 4}" r="1.6" fill="#fff" stroke="none"/>
  </g>`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ status: false, error: "Method Not Allowed" });
    }

    const body = req.method === "POST" ? (req.body || {}) : {};
    const get = (key, fallback = "") => req.method === "GET" ? req.query?.[key] ?? fallback : body?.[key] ?? fallback;

    let text = String(get("text", get("q", get("message", "")))).trim();
    let battery = Number(get("battery", 100));
    let time = String(get("time", "")).trim();
    let name = String(get("name", "")).trim();

    if (!text) return res.status(400).json({ status: false, error: "text (pesan) wajib diisi" });
    text = text.slice(0, 400);
    battery = Number.isFinite(battery) ? Math.round(clamp(battery, 1, 100)) : 100;
    time = (time || defaultTimeString()).slice(0, 8);
    name = name.slice(0, 30);

    const W = 720;
    const H = 480;
    const lines = wrapText(text, 34);
    const lineHeight = 39;
    const bubbleW = clamp(Math.max(...lines.map((l) => l.length)) * 14.2 + 52, 160, 560);
    const bubbleH = lines.length * lineHeight + 40;
    const bubbleX = 32;
    const bubbleY = clamp(H - bubbleH - 64, 100, H - bubbleH - 40);

    const textSpans = lines.map((line, i) =>
      `<tspan x="${bubbleX + 26}" dy="${i === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`
    ).join("");

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b0b10"/><stop offset="1" stop-color="#000000"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g font-family="Arial, Helvetica, sans-serif" fill="#fff">
    <text x="24" y="29" font-size="20" font-weight="600">${esc(time)}</text>
    ${signalSvg(W - 96, 16)}
    ${wifiSvg(W - 68, 20)}
    ${batterySvg(W - 52, 16, battery)}
    <text x="${W - 62}" y="29" text-anchor="end" font-size="14" font-weight="600">${battery}%</text>
  </g>
  <line x1="0" y1="46" x2="${W}" y2="46" stroke="#fff" stroke-opacity="0.08"/>
  ${name ? `<text x="${W / 2}" y="78" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="600" fill="#fff" fill-opacity="0.85">${esc(name)}</text>` : ""}
  <path d="M ${bubbleX + 26} ${bubbleY} H ${bubbleX + bubbleW - 26} Q ${bubbleX + bubbleW} ${bubbleY} ${bubbleX + bubbleW} ${bubbleY + 26} V ${bubbleY + bubbleH - 26} Q ${bubbleX + bubbleW} ${bubbleY + bubbleH} ${bubbleX + bubbleW - 26} ${bubbleY + bubbleH} H ${bubbleX + 26} Q ${bubbleX} ${bubbleY + bubbleH} ${bubbleX} ${bubbleY + bubbleH - 26} V ${bubbleY + 26} Q ${bubbleX} ${bubbleY} ${bubbleX + 26} ${bubbleY} Z" fill="#1c1c1e"/>
  <path d="M ${bubbleX + 10} ${bubbleY + bubbleH - 18} Q ${bubbleX - 4} ${bubbleY + bubbleH - 2} ${bubbleX - 10} ${bubbleY + bubbleH} Q ${bubbleX + 4} ${bubbleY + bubbleH} ${bubbleX + 20} ${bubbleY + bubbleH - 4} Z" fill="#1c1c1e"/>
  <text x="${bubbleX + 26}" y="${bubbleY + 30}" font-family="Arial, Helvetica, sans-serif" font-size="27" fill="#f2f2f2">${textSpans}</text>
  <text x="${bubbleX + 4}" y="${bubbleY + bubbleH + 22}" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#fff" fill-opacity="0.45">${esc(time)}</text>
  <text x="${W - 24}" y="${H - 20}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="600" fill="#9f8cff" fill-opacity="0.55">ONYX AI</text>
</svg>`;

    const buffer = Buffer.from(svg, "utf8");
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "no-store");
    return res.end(buffer);
  } catch (e) {
    console.error("IQC error:", e);
    return res.status(500).json({ status: false, error: e?.message || "Gagal membuat gambar IQC" });
  }
}
