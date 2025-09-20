# Goal

Ship a tiny Shopify app that auto‑generates WCAG‑friendly alt text (and optional SEO titles/descriptions) for new product images. Charge a small subscription. Keep the architecture boring so it runs itself.

---

## High‑level architecture

- **Frontend/Admin**: Next.js 14 (App Router) with a minimal dashboard (install, billing, logs).
- **Shopify App Core**: Next.js API route handlers using `@shopify/shopify-api` for OAuth + webhook verification.
- **Worker**: FastAPI service with a `/caption` endpoint that returns an `alt_text` for a given image URL (drop in BLIP/CLIP later).
- **DB**: SQLite or Postgres via Prisma for shops, tokens, usage.
- **Billing**: Stripe subscriptions (Starter, Growth, Pro). Trial 7 days.

---

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

---

## Environment variables

Copy `.env.example` to two files:

- `apps/web/.env.local`
- `apps/worker/.env`

```
# Shopify
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_SCOPES=read_products,write_products,read_product_listings
SHOPIFY_APP_URL=https://yourapp.example.com
SHOPIFY_WEBHOOK_SECRET=use_shopify_shared_secret

# Stripe
STRIPE_SECRET_KEY=sk_live_or_test
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_GROWTH=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Worker
WORKER_URL=http://localhost:8000

# Database
DATABASE_URL=file:./dev.db
```

---

## Next.js (Shopify app) — key files

### `apps/web/package.json`

```json
{
  "name": "alttext-web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "prisma:push": "prisma db push",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@shopify/shopify-api": "^11.2.0",
    "@shopify/shopify-app-remix": "^3.0.0",
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "zod": "^3.23.8",
    "prisma": "^5.18.0",
    "@prisma/client": "^5.18.0",
    "jsonwebtoken": "^9.0.2"
  }
}
```

### Prisma schema — `apps/web/prisma/schema.prisma`

```prisma
generator client { provider = "prisma-client-js" }

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Shop {
  id           String   @id @default(cuid())
  shop         String   @unique
  accessToken  String
  plan         String   @default("trial")
  stripeId     String?
  quotaUsed    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Log {
  id        String   @id @default(cuid())
  shop      String
  productId String
  imageId   String
  alt       String
  ok        Boolean
  msg       String?
  createdAt DateTime @default(now())
}
```

### Shopify helpers — `apps/web/lib/shopify.ts`

```ts
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: (process.env.SHOPIFY_SCOPES || "").split(","),
  isCustomStoreApp: false,
  apiVersion: ApiVersion.January25,
  hostName: process.env.SHOPIFY_APP_URL!.replace(/^https?:\/\//, ""),
});

export function getSession(shop: string, accessToken: string) {
  return new shopify.session.Session({
    id: `${shop}_${Date.now()}`,
    shop,
    state: "state",
    isOnline: false,
    accessToken,
  });
}
```

### OAuth start — `apps/web/app/api/shopify/install/route.ts`

```ts
import { shopify } from "@/lib/shopify";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) return NextResponse.json({ error: "Missing shop" }, { status: 400 });

  const authRoute = await shopify.auth.begin({
    shop,
    callbackPath: "/api/shopify/callback",
    isOnline: false,
    rawRequest: req as any,
    rawResponse: new Response(),
    // state + nonce handled internally
  });
  return NextResponse.redirect(authRoute, 302);
}
```

### OAuth callback — `apps/web/app/api/shopify/callback/route.ts`

```ts
import { shopify } from "@/lib/shopify";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { session } = await shopify.auth.callback({
    rawRequest: req as any,
    rawResponse: new Response(),
  });

  const shop = session.shop;
  await prisma.shop.upsert({
    where: { shop },
    update: { accessToken: session.accessToken },
    create: { shop, accessToken: session.accessToken },
  });

  // Register webhooks
  await shopify.webhooks.register({
    session,
    webhooks: [
      {
        path: "/api/webhooks/products",
        topic: "products/create",
        webhookHandler: async () => {}, // handler wired in route
      },
      {
        path: "/api/webhooks/products",
        topic: "products/update",
        webhookHandler: async () => {},
      },
    ],
  });

  // Redirect to dashboard/billing
  const appUrl = process.env.SHOPIFY_APP_URL;
  return NextResponse.redirect(`${appUrl}/dashboard`);
}
```

### Webhook handler — `apps/web/app/api/webhooks/products/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function verifyHmac(req: NextRequest, rawBody: string) {
  const h = req.headers.get("x-shopify-hmac-sha256") || "";
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
    .update(rawBody, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(digest));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifyHmac(req, rawBody)) return NextResponse.json({ ok: false }, { status: 401 });

  const topic = req.headers.get("x-shopify-topic");
  const shop = req.headers.get("x-shopify-shop-domain")!;
  const payload = JSON.parse(rawBody);

  // Grab first image (MVP)
  const image = payload?.images?.[0];
  if (!image?.src) return NextResponse.json({ ok: true });

  // Get worker to caption
  const res = await fetch(`${process.env.WORKER_URL}/caption`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image_url: image.src, title: payload.title, vendor: payload.vendor })
  });
  const data = await res.json();

  // Write alt text back to product image
  const shopRow = await prisma.shop.findUnique({ where: { shop } });
  if (!shopRow) return NextResponse.json({ ok: false }, { status: 404 });

  await fetch(`https://${shop}/admin/api/2025-01/products/${payload.id}/images/${image.id}.json`, {
    method: "PUT",
    headers: {
      "X-Shopify-Access-Token": shopRow.accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ image: { id: image.id, alt: data.alt_text } })
  });

  await prisma.log.create({
    data: {
      shop,
      productId: String(payload.id),
      imageId: String(image.id),
      alt: data.alt_text,
      ok: true
    }
  });

  return NextResponse.json({ ok: true });
}
```

### Minimal dashboard — `apps/web/app/dashboard/page.tsx`

```tsx
export default async function Dashboard() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">AltText Auto</h1>
      <p className="mt-2 text-sm text-gray-600">New products get accessible, SEO‑friendly alt text—automatically.</p>
      <div className="mt-6 space-x-3">
        <a href="/api/shopify/install?shop=YOUR_SHOP.myshopify.com" className="rounded bg-black px-4 py-2 text-white">Install to store</a>
        <a href="/billing" className="rounded border px-4 py-2">Manage billing</a>
      </div>
    </main>
  );
}
```

---

## FastAPI Worker — key files

### `apps/worker/pyproject.toml`

```toml
[project]
name = "alttext-worker"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
  "fastapi",
  "uvicorn[standard]",
  "pydantic>=2",
  "httpx",
  "pillow"
]
```

### `apps/worker/main.py`

```py
from fastapi import FastAPI
from pydantic import BaseModel, HttpUrl
import httpx
from PIL import Image
from io import BytesIO

app = FastAPI()

class CaptionIn(BaseModel):
    image_url: HttpUrl
    title: str | None = None
    vendor: str | None = None

class CaptionOut(BaseModel):
    alt_text: str

@app.post("/caption", response_model=CaptionOut)
async def caption(inp: CaptionIn):
    # Download image (timeout + small size cap in prod)
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(str(inp.image_url))
        r.raise_for_status()
    img = Image.open(BytesIO(r.content)).convert("RGB")

    # TODO: plug BLIP/CLIP. For MVP: naive heuristics
    alt = naive_alt(img, title=inp.title, vendor=inp.vendor)

    return CaptionOut(alt_text=alt)


def naive_alt(img: Image.Image, title: str | None, vendor: str | None) -> str:
    w, h = img.size
    shape = "square" if abs(w-h) < max(w,h)*0.1 else ("landscape" if w>h else "portrait")
    core = []
    if title:
        t = title.strip()
        # strip vendor/brand words from title to avoid duplication
        if vendor and vendor.lower() in t.lower():
            t = " ".join([w for w in t.split() if w.lower() != vendor.lower()])
        core.append(t)
    core.append(f"product photo, {shape} {w}x{h}px")
    alt = ", ".join([c for c in core if c]).strip()[:140]
    return alt
```

---

## Stripe billing (very skinny)

- Create three Prices in Stripe; set the IDs in env.
- Add a `/billing` page with links to Checkout sessions.

### `apps/web/app/api/billing/checkout/route.ts`

```ts
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const { shop, priceId } = await req.json();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.SHOPIFY_APP_URL}/dashboard?billing=success`,
    cancel_url: `${process.env.SHOPIFY_APP_URL}/dashboard?billing=cancel`,
  });
  return NextResponse.json({ url: session.url });
}
```

---

## Day‑1 manual test flow

1. Create a Shopify **Custom app** in Partners. App URL → \`[https\://localhost
