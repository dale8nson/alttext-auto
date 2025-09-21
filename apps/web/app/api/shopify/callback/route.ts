import { getShopify } from "../../../../lib/shopify";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const shopify = getShopify();
  const { session } = await shopify.auth.callback({
    rawRequest: req as any,
    rawResponse: new Response(),
  });

  const shop = session.shop as string;
  const accessToken = session.accessToken as string;
  await prisma.shop.upsert({
    where: { shop },
    update: { accessToken },
    create: { shop, accessToken },
  });
  // Register product webhooks via REST Admin API
  const topics = ["products/create", "products/update"];
  await Promise.all(
    topics.map(async (topic) => {
      try {
        await fetch(`https://${shop}/admin/api/2025-01/webhooks.json`, {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ webhook: { topic, address: `${process.env.SHOPIFY_APP_URL}/api/webhooks/products`, format: "json" } }),
        });
      } catch {}
    })
  );

  const appUrl = process.env.SHOPIFY_APP_URL;
  return NextResponse.redirect(`${appUrl}/dashboard?installed=1`);
}
