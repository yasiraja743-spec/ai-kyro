# ONYX AI — Single VPS + Vercel

Arsitektur sekarang memakai **1 VPS saja** untuk AI/gateway. Vercel hanya menjadi frontend + serverless proxy.

```text
Vercel
  | HTTPS
  v
ONE VPS
  |-- ONYX Gateway :8080
  |-- Qwen llama-server :8000
  |-- Image adapter :8188 (opsional)
  |-- Search provider key (opsional)
```

## 1. Jalankan Qwen di VPS

Contoh Qwen/llama-server CPU:

```bash
/opt/llama.cpp/build-cpu/bin/llama-server \
  -m /opt/models/qwen3/Qwen3-30B-A3B-Q4_K_M.gguf \
  --host 127.0.0.1 \
  --port 8000 \
  -t 48 \
  -c 8192
```

Pastikan dulu:

```bash
curl http://127.0.0.1:8000/v1/models
```

## 2. Jalankan gateway di VPS yang sama

```bash
cd gateway
npm install
cp .env.example .env
nano .env
```

Isi `.env`:

```text
PORT=8080
GATEWAY_SECRET=BUAT_SECRET_RANDOM
CHAT_URL=http://127.0.0.1:8000/v1/chat/completions
IMAGE_URL=http://127.0.0.1:8188/generate
EDIT_URL=http://127.0.0.1:8188/edit
TAVILY_API_KEY=
```

Buat secret random dengan:

```bash
openssl rand -hex 32
```

Lalu jalankan:

```bash
npm start
```

Test:

```bash
curl http://127.0.0.1:8080/health
```

## 3. Agar Vercel bisa mengakses VPS

`ONYX_GATEWAY_URL` **harus berupa URL HTTPS publik** yang mengarah ke port gateway `8080`. Jangan isi `127.0.0.1`, `localhost`, atau IP private.

Contoh:

```text
https://ai.domain-kamu.com
```

Jika VPS NAT tidak punya inbound port publik, gunakan tunnel/reverse proxy yang bisa diakses dari internet.

## 4. Vercel Environment Variables

Di Vercel buka:

**Project → Settings → Environment Variables**

Tambahkan:

```text
ONYX_GATEWAY_URL=https://ai.domain-kamu.com
ONYX_GATEWAY_SECRET=SECRET_YANG_SAMA_DENGAN_GATEWAY
```

Pilih environment yang dipakai (`Production`, dan `Preview` jika diperlukan), lalu **Redeploy**.

Jangan masukkan URL `CHAT_URL` atau model Qwen ke Vercel. Itu hanya berjalan di VPS.

## 5. Port

Yang boleh publik:

```text
8080  ONYX Gateway
```

Yang sebaiknya private:

```text
8000  Qwen
8188  Image adapter
```

## 6. Catatan image/search/file

Gateway single-VPS sudah menyiapkan route:

- `/v1/chat/completions` → Qwen lokal
- `/v1/images/generations` → image adapter lokal
- `/v1/images/edits` → image-edit adapter lokal
- `/v1/search` → Tavily jika `TAVILY_API_KEY` diisi

File/ZIP yang dibuat oleh aplikasi dapat tetap diproses dan dikirim oleh frontend/backend Vercel. Qwen sendiri tidak perlu menjadi server file.

## 7. API key + pembayaran otomatis (Pakasir)

Gateway sekarang punya sistem credit/API key berbasis SQLite dan QRIS Pakasir.

Tambahkan di `gateway/.env`:

```text
MIDTRANS_SERVER_KEY=ISI_SERVER_KEY_MIDTRANS
MIDTRANS_BASE_URL=https://api.midtrans.com
COST_CHAT=1
COST_IMAGE=5
COST_EDIT=5
COST_SEARCH=1
DATA_DIR=./data
```

Install dependency:

```bash
cd gateway
npm install
```

Endpoint internal Vercel:

```text
POST /api/payment
```

`action=key` membuat API key, `action=balance` mengecek credit, dan `action=create` membuat pembayaran QRIS.

Webhook Pakasir harus diarahkan ke:

```text
https://DOMAIN-GATEWAY/v1/payment/webhook
```

Webhook diverifikasi memakai `signature_key`. Setelah status settlement/capture valid, credit otomatis masuk ke akun customer.

> Untuk akun merchant/payment gateway yang mensyaratkan verifikasi identitas atau usia, gunakan akun merchant milik orang dewasa/wali yang memang berwenang. Jangan bypass verifikasi provider.
