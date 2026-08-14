# 🤖 Nova AI - Full Stack Version

Aplikasi web AI dengan chat lokal, generate image, dan photo editing — **100% independent dari REST API eksternal**.

## ✨ Fitur

- **Chat AI Lokal** — Powered by Ollama (mistral, llama2, neural-chat)
- **Photo Editing** — Enhance, blur, sharpen, grayscale dengan OpenCV
- **Riwayat Chat** — Sync ke Firebase Firestore (cross-device)
- **Message Actions** — Copy, edit, regenerate jawaban
- **Responsive UI** — Work di desktop & mobile
- **Zero External API Dependency** — Semua berjalan lokal (kecuali Ollama server)

## 🚀 Quick Start

### Local Development
```bash
# 1. Backend
cd backend
pip install -r requirements.txt
python app.py

# 2. Frontend (di terminal lain)
cd frontend
python -m http.server 8000
# Buka http://localhost:8000
```

### Production (Render + Vercel)
Lihat [SETUP.md](./SETUP.md) untuk detailed guide.

## 📋 Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (Vercel)                      │
│  - index.html (Vanilla JS)              │
│  - Firebase Auth & Firestore            │
│  - Message UI dengan actions            │
└────────────┬────────────────────────────┘
             │ HTTPS
┌────────────▼────────────────────────────┐
│  Backend (Render)                       │
│  - Flask API                            │
│  - OpenCV photo editing                 │
│  - Ollama client                        │
└────────────┬────────────────────────────┘
             │ HTTP
┌────────────▼────────────────────────────┐
│  Ollama Server (VPS/Laptop)             │
│  - Local AI models (mistral, llama2)    │
│  - LLM inference                        │
└─────────────────────────────────────────┘
```

## 🔧 Requirements

- **Local dev**: Python 3.11+, Ollama
- **Production backend**: Docker, Render account
- **Production frontend**: Vercel account
- **AI Server**: Ollama running somewhere (local/VPS)

## 📁 Structure

```
nova-full-stack/
├── frontend/
│   └── index.html          # Main app
├── backend/
│   ├── app.py              # Flask API
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── SETUP.md                # Detailed setup guide
├── README.md               # This file
└── .gitignore
```

## ⚙️ Configuration

### Backend (.env)
```
PORT=5000
OLLAMA_API=http://localhost:11434
OLLAMA_MODEL=mistral
FLASK_ENV=production
```

### Frontend (index.html)
```javascript
const BACKEND_URL = 'http://localhost:5000';  // Local
// or
const BACKEND_URL = 'https://nova-ai-backend.onrender.com';  // Production
```

## 🌐 Deployment

1. **Backend** → Render.com (free tier ok)
2. **Frontend** → Vercel.com (free tier ok)
3. **Ollama** → Your VPS/Laptop/Server

[Full guide di SETUP.md](./SETUP.md)

## ⚠️ Important Notes

- **Ollama Server Required**: Backend butuh Ollama running di background
- **Render Free Tier**: Auto-sleep 15 min, cold start 20-30 detik
- **Chat Response Time**: 10-60 detik (tergantung model & CPU)
- **No External APIs**: Semua local (kecuali Firebase untuk auth/storage)

## 📝 License

Bikin apa aja, gunakan semestinya.

## 🎉 Credits

Built with ❤️ by Kyro

---

**Next: [SETUP.md](./SETUP.md)** untuk langkah-langkah deploy lengkap.
