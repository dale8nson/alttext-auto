import { getShopify } from "../../../../lib/shopify";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) return NextResponse.json({ error: "Missing shop" }, { status: 400 });

  const shopify = getShopify();
  const authRoute = await shopify.auth.begin({
    shop,
    callbackPath: "/api/shopify/callback",
    isOnline: false,
    rawRequest: req as any,
    rawResponse: new Response(),
  });
  return NextResponse.redirect(authRoute, 302);
}
