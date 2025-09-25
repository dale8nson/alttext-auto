# AltText SaaS (MVP)

A tiny Shopify app that auto‑generates WCAG‑friendly alt text for new product images. Web app (Next.js) + caption worker (FastAPI). Boring architecture, easy ops.

## Repo layout

```
alttext-saas/
  apps/
    web/                 # Next.js (Shopify app + admin)
    worker/              # FastAPI caption worker
  packages/
    shared/              # shared types/constants
  .env.example
  README.md
```

## Setup

1. Copy envs:
   - `cp .env.example apps/web/.env.local`
   - `cp .env.example apps/worker/.env`

2. Apps/Web:
   - Node 18+
   - Inside `apps/web/` run `npm install`
   - Initialize Prisma: `npm run prisma:push`
   - Dev server: `npm run dev`

3. Worker:
   - Python 3.10+
   - Inside `apps/worker/` create venv and install: `pip install -e .` (or `pip install fastapi uvicorn[standard] pydantic httpx pillow`)
   - Start: `uvicorn main:app --reload --host 0.0.0.0 --port 8000`

## Shopify

- Create a Custom app in Partners.
- Use App URL: your web app URL (e.g. `http://localhost:3000`).
- Scopes: `read_products,write_products,read_product_listings`.
- Install URL: `/install` (prompts for your Shopify store domain before redirecting to Shopify).
- Compliance webhooks: `customers/data_request`, `customers/redact`, and `shop/redact` all point to `/api/webhooks/compliance` and HMAC verification is enforced.

## Billing (Stripe)

- Create three Prices in Stripe and set `STRIPE_PRICE_*` envs.
- Checkout route: `POST /api/billing/checkout` with `{ shop, priceId }` returns `{ url }`.

## Notes

- Webhook verification expects Node runtime in Next.js API routes.
- Database uses PostgreSQL; point `DATABASE_URL` at your pooled connection (if using PgBouncer) and `DATABASE_DIRECT_URL` at a direct port 5432 connection for migrations.
- Worker `naive_alt` is a placeholder; replace with a model later.

## License

Proprietary (placeholder). Update as needed.
## Deploy

1. Provision environment variables in your host (Vercel example):
   - `SHOPIFY_API_KEY`, `NEXT_PUBLIC_SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `SHOPIFY_APP_URL`
   - `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_STRIPE_PRICE_STARTER`, `NEXT_PUBLIC_STRIPE_PRICE_GROWTH`, `NEXT_PUBLIC_STRIPE_PRICE_PRO` (optional for UI)
   - `WORKER_URL`, `DATABASE_URL`, `DATABASE_DIRECT_URL`

2. Run `npx prisma migrate deploy` (or rely on `npm run build`, which uses `DATABASE_DIRECT_URL` when provided) against your production database.

3. In Stripe, add a webhook endpoint to `https://YOUR_DOMAIN/api/billing/webhook` and enable events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`

4. In Shopify Partners, set your App URL to `https://YOUR_DOMAIN` and add the install/callback routes.

5. Deploy the worker (FastAPI) and set `WORKER_URL` accordingly.

### Vercel
This repo includes a minimal `vercel.json` with a sensible default function budget. Next.js handles routing automatically.

### Local runner
Run both services together (worker + web):

```
bash scripts/dev-all.sh
```

This starts the FastAPI worker on 127.0.0.1:8000 and Next.js on 3000. Ctrl+C stops both.

## Launch Checklist

- Accounts
  - Shopify Partners account + a dev store
  - Stripe account (test + live modes)
  - Hosting (Vercel or similar) for the Next.js app
  - Hosting for the FastAPI worker (Render/Fly/EC2/etc.)

- Secrets/Config you must provide
  - Web (.env): `SHOPIFY_API_KEY`, `NEXT_PUBLIC_SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `SHOPIFY_APP_URL`
  - Web (.env): `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET`
  - Web (.env): `NEXT_PUBLIC_STRIPE_PRICE_STARTER`, `NEXT_PUBLIC_STRIPE_PRICE_GROWTH`, `NEXT_PUBLIC_STRIPE_PRICE_PRO` (optional UI)
  - Web (.env): `WORKER_URL`, `DATABASE_URL`, `DATABASE_DIRECT_URL`
  - Worker (.env): none required for MVP

- Shopify configuration
  - Set App URL to your deployed Next.js domain
  - Install the app on a dev store
  - Confirm webhooks register in the callback (Dashboard → Webhooks health shows status)

- Stripe configuration
  - Create 3 prices (Starter/Growth/Pro) and place IDs in env
  - Add webhook endpoint: `https://YOUR_DOMAIN/api/billing/webhook`
  - Enable events: `checkout.session.completed`, `customer.subscription.deleted`

- Database
  - Set `DATABASE_URL`/`DATABASE_DIRECT_URL` (Postgres) and run `npx prisma migrate deploy`

- Worker
  - Deploy and expose HTTPS; configure `WORKER_URL`

- QA
  - Install flow from landing → install → dashboard → create product with image → alt text appears
  - Billing: choose plan → Stripe Checkout → webhook updates plan (Dashboard shows new plan)
  - A11y: keyboard nav, focus rings, skip link, dark/light toggle
  - Performance: FX toggle off/on as desired
