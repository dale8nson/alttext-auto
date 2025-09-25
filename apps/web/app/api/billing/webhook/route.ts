import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureDatabase } from "@/lib/prisma";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  return new Stripe(key, { apiVersion: "2023-10-16" });
}

function planFromPrice(priceId: string | undefined) {
  if (!priceId) return null;
  const map: Record<string, string | undefined> = {
    [process.env.STRIPE_PRICE_STARTER || "price_starter"]: "starter",
    [process.env.STRIPE_PRICE_GROWTH || "price_growth"]: "growth",
    [process.env.STRIPE_PRICE_PRO || "price_pro"]: "pro",
  };
  return map[priceId] || null;
}

export async function POST(req: NextRequest) {
  await ensureDatabase();
  const signature = req.headers.get("stripe-signature") || "";
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const shop = (session.metadata as any)?.shop as string | undefined;
    const priceId = (session.metadata as any)?.priceId as string | undefined;
    const plan = planFromPrice(priceId);
    if (shop && plan) {
      await prisma.shop.update({ where: { shop }, data: { plan, stripeId: session.customer as string } }).catch(() => {});
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;
    // Reset affected shop to trial
    await prisma.shop.updateMany({ where: { stripeId: customerId }, data: { plan: "trial" } });
  }

  return NextResponse.json({ received: true });
}
