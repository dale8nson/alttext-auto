import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureDatabase } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  await ensureDatabase();
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get("shop") || undefined;
  const take = Math.min(parseInt(searchParams.get("take") || "10", 10), 100);
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);

  const where = shop ? { shop } : {} as any;
  const count = await prisma.log.count({ where });
  const pages = Math.max(1, Math.ceil(count / take));
  const skip = (page - 1) * take;

  const logs = await prisma.log.findMany({ where, orderBy: { createdAt: "desc" }, take, skip });
  return NextResponse.json({ logs, page, pages, count, take });
}
