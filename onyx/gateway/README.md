# ONYX AI Gateway — Single VPS

All ONYX AI services are intended to run on **one VPS**.

## Local services

- Qwen / llama-server: `127.0.0.1:8000`
- Image generation adapter: `127.0.0.1:8188/generate`
- Image editing adapter: `127.0.0.1:8188/edit`
- ONYX Gateway: `0.0.0.0:8080`

Only the gateway needs to be exposed publicly. Keep ports 8000 and 8188 private.

## Gateway environment

Copy `.env.example` to `.env` and set a strong `GATEWAY_SECRET`.

## Vercel

Set these Environment Variables on the Vercel project:

```text
ONYX_GATEWAY_URL=https://YOUR-PUBLIC-VPS-DOMAIN
ONYX_GATEWAY_SECRET=THE-SAME-GATEWAY_SECRET
```

Do not put Qwen/model provider keys in the browser. Search provider keys such as `TAVILY_API_KEY` stay on the VPS.

## Test

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8000/v1/models
```

## API key & payment

Supports SQLite API keys/credits and Midtrans QRIS webhook settlement. See ../SETUP.md.
