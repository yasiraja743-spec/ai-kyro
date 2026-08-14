export function hfToken() {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("HF_TOKEN belum dipasang di Vercel Environment Variables.");
  return token;
}

export function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function methodPost(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { status: false, error: "Method Not Allowed" });
    return false;
  }
  return true;
}

export async function parseJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}
