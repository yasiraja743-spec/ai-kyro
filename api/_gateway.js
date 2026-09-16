const GATEWAY_URL = String(process.env.ONYX_GATEWAY_URL || '').replace(/\/$/, '');
const GATEWAY_SECRET = process.env.ONYX_GATEWAY_SECRET || '';

export function gatewayConfigError() {
  if (!GATEWAY_URL) return new Error('ONYX_GATEWAY_URL belum dikonfigurasi');
  if (!GATEWAY_SECRET) return new Error('ONYX_GATEWAY_SECRET belum dikonfigurasi');
  return null;
}

export async function gatewayFetch(path, options = {}) {
  const err = gatewayConfigError();
  if (err) throw err;
  const headers = new Headers(options.headers || {});
  headers.set('X-ONYX-Gateway-Key', GATEWAY_SECRET);
  if (!headers.has('Accept')) headers.set('Accept', '*/*');
  return fetch(`${GATEWAY_URL}${path}`, { ...options, headers });
}

export async function readError(response) {
  const text = await response.text().catch(() => '');
  try {
    const data = JSON.parse(text);
    return data?.error || data?.message || text || `HTTP ${response.status}`;
  } catch {
    return text || `HTTP ${response.status}`;
  }
}
