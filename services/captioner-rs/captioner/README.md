Captioner (Rust) — Remote GPU Inference Option

Endpoints

- GET /health: basic health + request count
- POST /v1/caption: { image_url, product_title? } → { alt_text, tags }
- POST /v1/bulk: { items: CaptionReq[] } → { results: ItemOutcome[] }

Remote Inference (optional)

- Set CAPTIONER_REMOTE_INFER_URLS to a comma-separated list of endpoints (or CAPTIONER_REMOTE_INFER_URL for a single endpoint) pointing at the FastAPI server (see tools/blip_infer_server/server.py).
- The service tries endpoints in round-robin order per request and fails over on errors/timeouts (429/5xx included). If all endpoints fail, it falls back to local ONNX inference.

Shopify Guidelines

- Alt text capped at 125 chars (soft) and avoids prefixes like “image of”.
- Refinement heuristics bias toward product-centric phrases using optional tags/title.

Deploy to Fly.io

- Dockerfile and fly.toml provided. From repo root:
  fly launch --no-deploy --copy-config --name YOUR_APP --region iad
  fly secrets set ...
  fly deploy
