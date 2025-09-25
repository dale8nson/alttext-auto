import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma, ensureDatabase } from "@/lib/prisma";

export const runtime = "nodejs";

function verifyHmac(req: NextRequest, rawBody: string) {
  const h = req.headers.get("x-shopify-hmac-sha256") || "";
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
    .update(rawBody, "utf8")
    .digest("base64");
  if (h.length !== digest.length) return false;
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(digest));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifyHmac(req, rawBody)) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    await ensureDatabase();
    const shop = req.headers.get("x-shopify-shop-domain")!;
    const payload = JSON.parse(rawBody);

    const image = payload?.images?.[0];
    if (!image?.src) return NextResponse.json({ ok: true });

    const workerUrl = process.env.WORKER_URL;
    if (!workerUrl) throw new Error("WORKER_URL not set");

    const res = await fetch(`${workerUrl}/caption`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image_url: image.src, title: payload.title, vendor: payload.vendor })
    });
    const data = await res.json().catch(() => ({ alt_text: "product photo" }));

    const shopRow = await prisma.shop.findUnique({ where: { shop } });
    if (!shopRow) return NextResponse.json({ ok: false }, { status: 404 });

    await fetch(`https://${shop}/admin/api/2025-01/products/${payload.id}/images/${image.id}.json`, {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": shopRow.accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ image: { id: image.id, alt: data.alt_text || "product photo" } })
    });

    await prisma.log.create({
      data: {
        shop,
        productId: String(payload.id),
        imageId: String(image.id),
        alt: data.alt_text || "product photo",
        ok: true
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    try {
      const shop = req.headers.get("x-shopify-shop-domain") || "";
      const payload = JSON.parse(rawBody);
      const image = payload?.images?.[0];
      if (image?.id) {
        await prisma.log.create({
          data: { shop, productId: String(payload?.id || ""), imageId: String(image.id), alt: "", ok: false, msg: String(e) }
        });
      }
    } catch {}
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
