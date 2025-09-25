import { getShopify } from "../../../../lib/shopify";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const shopify = getShopify();
  const { session, headers } = await shopify.auth.callback({
    rawRequest: req as any,
  });

  const shop = session.shop as string;
  const accessToken = session.accessToken as string;
  await prisma.shop.upsert({
    where: { shop },
    update: { accessToken },
    create: { shop, accessToken },
  });
  // Register product webhooks via REST Admin API
  const appUrl = process.env.SHOPIFY_APP_URL || "http://localhost:3000";
  const topics = [
    "products/create",
    "products/update",
    "customers/data_request",
    "customers/redact",
    "shop/redact"
  ];
  await Promise.all(
    topics.map(async (topic) => {
      try {
        await fetch(`https://${shop}/admin/api/2025-01/webhooks.json`, {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            webhook: {
              topic,
              address: `${appUrl}/api/webhooks/${topic.startsWith("products") ? "products" : "compliance"}`,
              format: "json"
            }
          }),
        });
      } catch {}
    })
  );

  const redirectResponse = NextResponse.redirect(`${appUrl}/dashboard?installed=1`);

  if (headers) {
    const headerEntries: Array<[string, string]> = [];

    const getSetCookie = (headers as any)?.getSetCookie?.bind(headers);
    if (typeof getSetCookie === "function") {
      const cookies = getSetCookie();
      if (Array.isArray(cookies)) {
        cookies.forEach((cookie: string) => {
          headerEntries.push(["set-cookie", cookie]);
        });
      }
    }

    if (headerEntries.length === 0) {
      if (headers instanceof Headers) {
        headers.forEach((value, key) => headerEntries.push([key, value]));
      } else if (typeof headers === "object") {
        Object.entries(headers).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((item) => headerEntries.push([key, String(item)]));
          } else if (value != null) {
            headerEntries.push([key, String(value)]);
          }
        });
      }
    }

    headerEntries.forEach(([key, value]) => {
      if (key.toLowerCase() === "set-cookie") {
        redirectResponse.headers.append("set-cookie", value);
      } else if (!redirectResponse.headers.has(key)) {
        redirectResponse.headers.set(key, value);
      }
    });
  }

  return redirectResponse;
}
