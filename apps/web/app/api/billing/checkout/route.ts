import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  // Instantiate lazily to avoid build-time env issues
  return new Stripe(key, { apiVersion: "2023-10-16" });
}

export async function POST(req: NextRequest) {
  const { shop, priceId } = await req.json();
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.SHOPIFY_APP_URL}/dashboard?billing=success`,
    cancel_url: `${process.env.SHOPIFY_APP_URL}/dashboard?billing=cancel`,
    metadata: { shop, priceId },
  });
  return NextResponse.json({ url: session.url });
}
