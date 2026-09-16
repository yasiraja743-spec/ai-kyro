import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'onyx.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  customer_id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS payments (
  order_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);
`);

const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');

export function ensureAccount(customerId) {
  db.prepare('INSERT OR IGNORE INTO accounts(customer_id) VALUES (?)').run(customerId);
}

export function issueApiKey(customerId) {
  ensureAccount(customerId);
  const raw = 'onyx_' + crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO api_keys(customer_id,key_hash,key_prefix) VALUES (?,?,?)')
    .run(customerId, hash(raw), raw.slice(0, 13));
  return raw;
}

export function findApiKey(raw) {
  if (!raw) return null;
  return db.prepare(`SELECT a.customer_id, a.credits, k.id AS key_id
    FROM api_keys k JOIN accounts a ON a.customer_id=k.customer_id
    WHERE k.key_hash=? AND k.revoked_at IS NULL`).get(hash(raw)) || null;
}

export function getBalance(customerId) {
  ensureAccount(customerId);
  return db.prepare('SELECT credits FROM accounts WHERE customer_id=?').get(customerId)?.credits ?? 0;
}

export function addCredits(customerId, credits) {
  ensureAccount(customerId);
  db.prepare('UPDATE accounts SET credits=credits+?,updated_at=CURRENT_TIMESTAMP WHERE customer_id=?').run(credits, customerId);
}

export function spendCredits(customerId, credits) {
  ensureAccount(customerId);
  const r = db.prepare('UPDATE accounts SET credits=credits-?,updated_at=CURRENT_TIMESTAMP WHERE customer_id=? AND credits>=?')
    .run(credits, customerId, credits);
  return r.changes === 1;
}

export function refundCredits(customerId, credits) { addCredits(customerId, credits); }

export function createPaymentRow(orderId, customerId, amount, credits) {
  db.prepare('INSERT INTO payments(order_id,customer_id,amount,credits) VALUES (?,?,?,?)')
    .run(orderId, customerId, amount, credits);
}

export function getPayment(orderId) {
  return db.prepare('SELECT * FROM payments WHERE order_id=?').get(orderId);
}

export function settlePayment(orderId, paymentType = 'unknown') {
  const tx = db.transaction(() => {
    const p = getPayment(orderId);
    if (!p) return { ok: false, reason: 'order_not_found' };
    if (p.status === 'paid') return { ok: true, already: true, customerId: p.customer_id, credits: p.credits };
    db.prepare(`UPDATE payments SET status='paid',payment_type=?,paid_at=CURRENT_TIMESTAMP WHERE order_id=?`)
      .run(paymentType, orderId);
    addCredits(p.customer_id, p.credits);
    return { ok: true, already: false, customerId: p.customer_id, credits: p.credits };
  });
  return tx();
}

export function updatePaymentStatus(orderId, status, paymentType = null) {
  db.prepare('UPDATE payments SET status=?,payment_type=COALESCE(?,payment_type) WHERE order_id=?').run(status, paymentType, orderId);
}

export { db };
