import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureDatabase } from "@/lib/prisma";

export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  await ensureDatabase();
  const { searchParams } = new URL(req.url);
  const shopParam = searchParams.get("shop");
  const shopRow = shopParam ? await prisma.shop.findUnique({ where: { shop: shopParam } }) : await prisma.shop.findFirst();
  if (!shopRow) return NextResponse.json({ ok: false, error: "No shop configured" }, { status: 404 });

  try {
    const resp = await fetch(`https://${shopRow.shop}/admin/api/2025-01/webhooks.json`, {
      headers: {
        "X-Shopify-Access-Token": shopRow.accessToken,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!resp.ok) throw new Error(`Shopify ${resp.status}`);
    const data = await resp.json();
    const webhooks = data?.webhooks || [];
    return NextResponse.json({ ok: true, webhooks, count: webhooks.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
