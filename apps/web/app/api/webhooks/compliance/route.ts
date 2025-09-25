import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";

const prisma = new PrismaClient();

function verifyHmac(req: NextRequest, rawBody: string) {
  const hmac = req.headers.get("x-shopify-hmac-sha256") || "";
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET || "")
    .update(rawBody, "utf8")
    .digest("base64");
  if (!hmac || hmac.length !== digest.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(digest));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifyHmac(req, rawBody)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const shop = req.headers.get("x-shopify-shop-domain") || "";
    const payload = JSON.parse(rawBody);
    const topic = payload?.topic ?? "";

    if (topic === "shop/redact") {
      await prisma.log.deleteMany({ where: { shop } });
      await prisma.shop.deleteMany({ where: { shop } });
    } else if (topic === "customers/redact") {
      await prisma.log.deleteMany({ where: { shop } });
    }
  } catch (error) {
    console.error("Compliance webhook handling failed", error);
  }

  return NextResponse.json({ ok: true });
}
