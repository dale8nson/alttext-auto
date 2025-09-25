import { NextResponse } from "next/server";
import { prisma, ensureDatabase } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  await ensureDatabase();
  const shop = await prisma.shop.findFirst({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ shop });
}
