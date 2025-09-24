import { getShopify } from "../../../../lib/shopify";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) return NextResponse.json({ error: "Missing shop" }, { status: 400 });

  const shopify = getShopify();
  const authResponse = await shopify.auth.begin({
    shop,
    callbackPath: "/api/shopify/callback",
    isOnline: false,
    rawRequest: req as any,
  });
  return authResponse as Response;
}
