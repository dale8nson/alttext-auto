import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const base = process.env.SHOPIFY_APP_URL || "http://localhost:3000";
  const body = `User-agent: *
Allow: /
Sitemap: ${base.replace(/\/$/, "")}/sitemap.xml\n`;
  return new NextResponse(body, { headers: { "content-type": "text/plain" } });
}

