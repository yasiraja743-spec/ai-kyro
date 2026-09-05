# 🚀 Nova AI Full-Stack Setup Guide

## Struktur Project
```
nova-full-stack/
├── frontend/           # React/HTML frontend
│   └── index.html      # Main app
├── backend/            # Python Flask backend
│   ├── app.py          # Main backend
│   ├── requirements.txt # Dependencies
│   ├── Dockerfile      # Container config
│   └── .env.example    # Environment template
├── .gitignore          # Git ignore
└── SETUP.md            # This file
```

## 🔧 Setup Lokal (Local Development)

### Kebutuhan:
- Python 3.11+
- Ollama (download dari ollama.ai)
- Git

### Langkah 1: Setup Backend

```bash
# 1. Masuk folder backend
cd backend

# 2. Buat virtual environment
python -m venv venv

# Linux/Mac:
source venv/bin/activate

# Windows:
venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy .env.example ke .env
cp .env.example .env

# 5. Download Ollama model
ollama pull mistral

# 6. Jalankan Ollama (di terminal terpisah)
ollama serve

# 7. Jalankan backend (di terminal lain)
python app.py
# Backend running di http://localhost:5000
```

### Langkah 2: Frontend (Local Testing)

```bash
# Buka file dengan simple HTTP server
cd ../frontend

# Python 3:
python -m http.server 8000

# Buka browser: http://localhost:8000
```

## ☁️ Deploy ke Render (Production)

### Kebutuhan:
- GitHub repo dengan folder ini
- Render.com account (free tier OK)
- Ollama server running somewhere (kita set up di step 4)

### Langkah 1: Push ke GitHub

```bash
# Dari root project folder
git init
git add .
git commit -m "Initial Nova AI full-stack"
git branch -M main
git remote add origin https://github.com/USERNAME/nova-full-stack.git
git push -u origin main
```

### Langkah 2: Deploy Backend ke Render

1. Pergi ke **render.com** → **New +** → **Web Service**
2. Connect GitHub repository kamu
3. Setup berikut:
   - **Name**: `nova-ai-backend`
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Plan**: Free (atau Starter kalau mau performance lebih baik)

4. Add Environment Variables:
   ```
   OLLAMA_API=http://your-ollama-server.com:11434
   OLLAMA_MODEL=mistral
   FLASK_ENV=production
   ```

5. Deploy & tunggu (~2-3 menit)

### Langkah 3: Deploy Frontend ke Vercel

1. Pergi ke **vercel.com** → **New Project**
2. Import GitHub repository
3. Setup:
   - **Root Directory**: `frontend`
   - **Framework**: `Other`
   - **Build Command**: (skip, leave empty)
   - **Output Directory**: (skip)

4. Add Environment Variables:
   ```
   REACT_APP_BACKEND_URL=https://nova-ai-backend.onrender.com
   ```
   (Ganti dengan URL Render backend kamu)

5. Deploy

### Langkah 4: Setup Ollama Server (Optional tapi Recommended)

Kalau nggak punya Ollama server running, Render backend bakal error.

**Option A: Ollama di VPS/Laptop lokal (Simple)**
- Pasang Ollama di mesin
- `ollama serve` (jangan tutup terminal ini)
- Update OLLAMA_API di Render env vars ke IP mesin kamu

**Option B: Railway Ollama (Advanced)**
- Deploy Ollama di Railway.app
- Set OLLAMA_API ke Railway URL

**Option C: Run lokal cuma untuk testing**
- Backend di Render nggak bisa connect ke localhost Ollama
- Untuk development, jalankan semuanya lokal (localhost:5000 + localhost:8000)

## 📝 Catatan Penting

### Render Free Tier Limitations:
- **Auto-sleep**: Jika nggak ada request selama 15 menit, service sleep
- **Cold start**: Pertama request bisa 20-30 detik
- **Timeout**: Max request 30 detik
- **Connections**: Ollama inference bisa 20-60 detik → bisa timeout

**Solusi**: Upgrade ke Paid atau run backend locally.

### Ollama Model Size:
- **mistral**: ~4GB (cepat, cukup bagus)
- **llama2**: ~3.8GB (lebih ringan)
- **neural-chat**: ~3.8GB (optimized)

Ganti di `OLLAMA_MODEL` env var.

### Photo Edit (OpenCV):
- Works offline (nggak perlu API eksternal)
- Operations: enhance, blur, sharpen, grayscale
- Max image size: 1024x1024 (optimize buat memory)

### Chat Response Time:
- Local (GPU): 2-5 detik
- Local (CPU): 5-20 detik
- Render free tier: 20-60 detik (cold start) + 10-30 detik inference

## 🐛 Troubleshooting

### Backend error "Ollama belum siap"
→ Check Ollama server running (`ollama serve`)
→ Check OLLAMA_API correct di env variables

### Frontend error "Backend error: HTTP 503"
→ Backend loading, tunggu 30 detik
→ Check Render health endpoint: `https://nova-ai-backend.onrender.com/health`

### Timeout error (30 detik)
→ Normal untuk free tier dengan Ollama inference
→ Buat production, upgrade Render ke Starter tier ($7/month)

### CORS error
→ Flask-CORS sudah setup di backend
→ Check frontend BACKEND_URL di env variables

## 🚀 Next Steps

1. **Local testing dulu** (jalankan backend + frontend lokal)
2. **Setup Ollama server** (lokal atau VPS)
3. **Deploy backend** ke Render
4. **Deploy frontend** ke Vercel
5. **Test full flow** dari Vercel frontend ke Render backend ke Ollama

## 📞 Support

Jika ada error:
1. Check `/health` endpoint
2. See backend logs di Render dashboard
3. Check browser console (F12)
4. Pastikan Ollama server running

Good luck! 🎉

## Cloudflare AI Image Generation (Vercel)

Image generation ONYX AI memakai Cloudflare AI model `flux-1-schnell`.
Jangan taruh API token Cloudflare di `index.html` atau frontend. Simpan sebagai Environment Variables di project Vercel:

```text
PIXAZO_API_KEY=your_cloudflare_account_id
PIXAZO_API_KEY=your_cloudflare_workers_ai_token
XKIRO_API_KEY=your_xkiro_key
```

Untuk token Cloudflare Workers AI REST API, gunakan token yang memiliki permission Workers AI yang diperlukan. Endpoint server Vercel akan memanggil Cloudflare, lalu mengirim hasil gambar kembali ke browser.

Setelah menambahkan/mengubah env var, lakukan **Redeploy** di Vercel agar function mendapatkan nilai baru.

### Parameter image generation

`POST /api/generate-image` menerima:

```json
{
  "prompt": "A futuristic phoenix robot",
  "aspect_ratio": "1:1",
  "quality": "medium",
  "resolution": "1k"
}
```

`aspect_ratio` tetap diterima untuk kompatibilitas frontend lama, tetapi FLUX.1 [schnell] memakai prompt dan steps. Endpoint mengembalikan file gambar langsung, jadi frontend lama tetap kompatibel.

### IQC

`/api/iqc` sekarang menggunakan SVG murni sehingga tidak membutuhkan native `@napi-rs/canvas` dan lebih aman untuk Vercel Serverless Functions. Browser tetap dapat menampilkan hasilnya sebagai image.
