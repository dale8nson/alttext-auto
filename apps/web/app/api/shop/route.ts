import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
const prisma = new PrismaClient();

export async function GET() {
  const shop = await prisma.shop.findFirst({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ shop });
}

