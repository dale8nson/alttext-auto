Expose Kaggle/Colab BLIP Server via Cloudflare Tunnel

Overview

- Start the FastAPI server on the notebook (see server.py) at 0.0.0.0:8001
- Use a temporary Cloudflare Quick Tunnel to obtain a public HTTPS URL
- Set the Rust service env `CAPTIONER_REMOTE_INFER_URLS` to include the tunnel URL first (Kaggle), with Colab as a second fallback

Kaggle Notebook (preferred first)

1) Enable Internet and GPU in Notebook settings.
2) Install deps (first cell):
   !pip -q install fastapi uvicorn transformers pillow accelerate torch cloudflared
3) Start the BLIP server (second cell):
   import subprocess, os, threading
   from tools.blip_infer_server.server import app  # if you uploaded the repo
   # Or fallback: from a raw URL, e.g. wget the server.py into current dir
   !nohup python -m uvicorn tools.blip_infer_server.server:app --host 0.0.0.0 --port 8001 >/dev/null 2>&1 &
4) Start the tunnel (third cell):
   import re, subprocess, time
   p = subprocess.Popen(["cloudflared", "tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:8001"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
   public_url = None
   for _ in range(120):
       line = p.stdout.readline().strip()
       if not line: time.sleep(1); continue
       m = re.search(r"https://[\w.-]+\.trycloudflare\.com", line)
       if m: public_url = m.group(0); break
   print("PUBLIC_URL=", public_url)
   # Keep this cell running to keep the tunnel alive; open a new cell to continue.
5) Auto‑register with the captioner (preferred). Set envs in the notebook:
   %env CAPTIONER_REGISTRY_URL=https://YOUR_CAPTIONER.fly.dev
   %env CAPTIONER_REGISTRY_TOKEN=YOUR_SECRET  # set the same secret on Fly via `fly secrets set`
   %env PROVIDER=kaggle
   Then run the registration cell (included in the notebook). It renews every 10 minutes.

Colab Notebook (fallback when Kaggle quota is exhausted)

Use the same steps as Kaggle. If you expect quotas to exhaust, configure Rust with both endpoints:

Prefer dynamic registration over static URLs. Captioner will prefer providers in CAPTIONER_PROVIDER_ORDER (default kaggle,colab) and back off throttled endpoints for CAPTIONER_REMOTE_BACKOFF_SECS seconds.

Rust service configuration

- Prefer Kaggle first by placing it first in `CAPTIONER_REMOTE_INFER_URLS`.
- The service will fail over to the next endpoint on 429/5xx/timeouts and apply backoff for `CAPTIONER_REMOTE_BACKOFF_SECS` seconds.
- If all endpoints fail, it falls back to local ONNX inference.

Security notes

- Quick Tunnels are public and un-authenticated by default. Use random endpoints and rotate often; do not expose admin endpoints.
- Keep the notebook private and avoid printing secrets.
