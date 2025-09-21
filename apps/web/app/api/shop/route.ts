import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const prisma = new PrismaClient();

export async function GET() {
  const shop = await prisma.shop.findFirst({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ shop });
}
