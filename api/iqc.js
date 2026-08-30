// api/iqc.js
// Generate "IQC" (iPhone Quote Chat) style screenshot: dark message bubble
// mimicking iMessage/WhatsApp dark mode, with a configurable status bar
// (time + battery). Self-contained (no external image/font downloads) so
// the response is reliable — selalu balikin PNG asli, bukan JSON aneh-aneh.
import { createCanvas } from "@napi-rs/canvas";

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? cur + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function defaultTimeString() {
  const now = new Date();
  // WIB (UTC+7), sama kayak konvensi jam di status bar screenshot lokal
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const h = wib.getUTCHours().toString().padStart(2, "0");
  const m = wib.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function drawBatteryIcon(ctx, x, y, pct) {
  // body
  const w = 25, h = 12, r = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.2;
  drawRoundedRect(ctx, x, y, w, h, r);
  ctx.stroke();
  // tip
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  drawRoundedRect(ctx, x + w + 1.5, y + h / 2 - 2, 2, 4, 1);
  ctx.fill();
  // fill level
  const inset = 2;
  const fillW = Math.max(0, (w - inset * 2) * (pct / 100));
  ctx.fillStyle = pct <= 20 ? "#FF453A" : "#ffffff";
  drawRoundedRect(ctx, x + inset, y + inset, fillW, h - inset * 2, 1.5);
  ctx.fill();
}

function drawSignalIcon(ctx, x, y) {
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  const bars = [4, 7, 10, 13];
  bars.forEach((barH, i) => {
    ctx.fillRect(x + i * 6, y + (13 - barH), 4, barH);
  });
}

function drawWifiIcon(ctx, x, y) {
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const radius = 4 + i * 4;
    ctx.beginPath();
    ctx.arc(x, y, radius, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(x, y, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

export default async function handler(req, res) {
  try {
    let text = "";
    let battery = 100;
    let time = "";
    let name = "";

    if (req.method === "GET") {
      text = String(req.query?.text ?? req.query?.q ?? req.query?.message ?? "").trim();
      battery = req.query?.battery !== undefined ? Number(req.query.battery) : 100;
      time = String(req.query?.time ?? "").trim();
      name = String(req.query?.name ?? "").trim();
    } else if (req.method === "POST") {
      const body = req.body || {};
      text = String(body.text ?? body.q ?? body.message ?? "").trim();
      battery = body.battery !== undefined ? Number(body.battery) : 100;
      time = String(body.time ?? "").trim();
      name = String(body.name ?? "").trim();
    } else {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ status: false, error: "Method Not Allowed" });
    }

    if (!text) {
      return res.status(400).json({ status: false, error: "text (pesan) wajib diisi" });
    }
    if (text.length > 400) text = text.slice(0, 400);
    if (!Number.isFinite(battery)) battery = 100;
    battery = Math.round(clamp(battery, 1, 100));
    if (!time) time = defaultTimeString();
    time = time.slice(0, 8);
    if (name) name = name.slice(0, 30);

    const W = 720;
    const H = 480;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // background (dark phone screen)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0b0b10");
    bgGrad.addColorStop(1, "#000000");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ---- status bar ----
    const statusY = 22;
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 20px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(time, 24, statusY);

    drawSignalIcon(ctx, W - 96, statusY - 6);
    drawWifiIcon(ctx, W - 68, statusY);
    drawBatteryIcon(ctx, W - 52, statusY - 6, battery);
    ctx.font = "600 14px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${battery}%`, W - 62, statusY);

    // header divider
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 46);
    ctx.lineTo(W, 46);
    ctx.stroke();

    if (name) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "600 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, W / 2, 78);
    }

    // ---- pesan bubble ----
    const fontSize = 27;
    const font = `400 ${fontSize}px sans-serif`;
    const maxBubbleWidth = 520;
    const paddingX = 26;
    const paddingY = 20;
    const lineHeight = fontSize + 12;

    const lines = wrapText(ctx, text, maxBubbleWidth - paddingX * 2, font);
    let longest = 0;
    ctx.font = font;
    for (const l of lines) longest = Math.max(longest, ctx.measureText(l).width);

    const bubbleW = clamp(longest + paddingX * 2, 160, maxBubbleWidth);
    const bubbleH = lines.length * lineHeight + paddingY * 2;
    const bubbleX = 32;
    const bubbleY = clamp(H - bubbleH - 64, 100, H - bubbleH - 40);

    ctx.fillStyle = "#1c1c1e";
    drawRoundedRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 26);
    ctx.fill();

    // ekor bubble kecil di kiri bawah (khas iMessage/WA)
    ctx.beginPath();
    ctx.moveTo(bubbleX + 10, bubbleY + bubbleH - 18);
    ctx.quadraticCurveTo(bubbleX - 4, bubbleY + bubbleH - 2, bubbleX - 10, bubbleY + bubbleH);
    ctx.quadraticCurveTo(bubbleX + 4, bubbleY + bubbleH, bubbleX + 20, bubbleY + bubbleH - 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f2f2f2";
    ctx.font = font;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    lines.forEach((line, i) => {
      const ly = bubbleY + paddingY + i * lineHeight + lineHeight / 2 - 4;
      ctx.fillText(line, bubbleX + paddingX, ly);
    });

    // timestamp kecil di bawah bubble
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "400 16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(time, bubbleX + 4, bubbleY + bubbleH + 22);

    // watermark ONYX AI, kecil, pojok kanan bawah
    ctx.fillStyle = "rgba(159,140,255,0.55)";
    ctx.font = "600 14px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("ONYX AI", W - 24, H - 20);

    const buffer = canvas.toBuffer("image/png");

    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");
    return res.end(buffer);
  } catch (e) {
    console.error("IQC error:", e);
    return res.status(500).json({
      status: false,
      error: e?.message || "Gagal membuat gambar IQC"
    });
  }
}
