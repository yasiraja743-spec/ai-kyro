# ONYX AI — Single VPS deployment

The previous 4-VPS layout has been replaced by a **single VPS** layout.

## Architecture

```text
Vercel Frontend
      |
      | HTTPS + X-ONYX-Gateway-Key
      v
ONE VPS
  |
  +-- ONYX Gateway :8080
  |
  +-- Qwen3 / llama-server :8000
  |
  +-- Image generation adapter :8188
  |
  +-- Image editing adapter :8188
  |
  +-- Optional Tavily search key
```

The gateway uses localhost for all local AI services. Only port 8080 should be exposed publicly; 8000 and 8188 should remain private.

## Vercel Environment Variables

Set only:

```text
ONYX_GATEWAY_URL=https://YOUR-PUBLIC-VPS-DOMAIN
ONYX_GATEWAY_SECRET=THE-SAME-RANDOM-SECRET-AS-GATEWAY
```

The secret must be identical on Vercel and the VPS gateway.

## VPS gateway `.env`

```text
PORT=8080
GATEWAY_SECRET=THE-SAME-RANDOM-SECRET
CHAT_URL=http://127.0.0.1:8000/v1/chat/completions
IMAGE_URL=http://127.0.0.1:8188/generate
EDIT_URL=http://127.0.0.1:8188/edit
TAVILY_API_KEY=
```

## Qwen

Run the CPU-only `llama-server` on port 8000. The Qwen GGUF model stays on this same VPS.
