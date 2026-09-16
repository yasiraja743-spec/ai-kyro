# ONYX AI — ENV single VPS

```env
PORT=8080
GATEWAY_SECRET=BUAT_RANDOM_PANJANG
CHAT_URL=http://127.0.0.1:8000/v1/chat/completions
PIXAZO_API_KEY=ISI_API_KEY_PIXAZO
PIXAZO_BASE_URL=https://gateway.pixazo.ai
PIXAZO_IMAGE_MODEL=flux/text-to-image
PIXAZO_EDIT_MODEL=p-image/v1/p-image-edit/generate
TAVILY_API_KEY=ISI_API_KEY_TAVILY
PAKASIR_PROJECT=kyro
PAKASIR_API_KEY=ISI_API_KEY_PAKASIR
PAKASIR_BASE_URL=https://app.pakasir.com
COST_CHAT=0
COST_IMAGE=5
COST_EDIT=5
COST_SEARCH=0
DATA_DIR=./data
```

Required: GATEWAY_SECRET (buat sendiri), PIXAZO_API_KEY (generate + edit), TAVILY_API_KEY (web search), MIDTRANS_SERVER_KEY (payment). Qwen local tidak perlu API key.

Vercel:
```env
ONYX_GATEWAY_URL=https://DOMAIN-VPS-KAMU
ONYX_GATEWAY_SECRET=SAMA_DENGAN_GATEWAY_SECRET
```

Midtrans webhook: `https://DOMAIN-VPS-KAMU/v1/payment/webhook`
