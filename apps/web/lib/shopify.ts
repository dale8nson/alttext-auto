import "@shopify/shopify-api/adapters/node";
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";

export function getShopify() {
  const appUrl = process.env.SHOPIFY_APP_URL || "http://localhost:3000";
  const hostName = appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiKey =
    process.env.SHOPIFY_API_KEY || process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const apiSecretKey = process.env.SHOPIFY_API_SECRET;
  const scopes = (process.env.SHOPIFY_SCOPES || "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  if (!apiKey) {
    throw new Error("Missing SHOPIFY_API_KEY environment variable");
  }

  if (!apiSecretKey) {
    throw new Error("Missing SHOPIFY_API_SECRET environment variable");
  }

  // Create instance lazily at runtime to avoid build-time env requirement
  return shopifyApi({
    apiKey,
    apiSecretKey,
    scopes,
    isEmbeddedApp: false,
    apiVersion: ApiVersion.January25,
    hostName,
  } as any);
}

export function getSession(shop: string, accessToken: string) {
  const s = getShopify() as any;
  // @ts-ignore - runtime provided by library
  return new s.session.Session({
    id: `${shop}_${Date.now()}`,
    shop,
    state: "state",
    isOnline: false,
    accessToken,
  });
}
