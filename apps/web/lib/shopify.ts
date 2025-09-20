import "@shopify/shopify-api/adapters/node";
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";

const appUrl = (process.env.SHOPIFY_APP_URL || 'http://localhost:3000');
const hostName = appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: (process.env.SHOPIFY_SCOPES || "").split(","),
  isEmbeddedApp: false,
  apiVersion: ApiVersion.January25,
  hostName,
} as any);

export function getSession(shop: string, accessToken: string) {
  // @ts-ignore - runtime provided by library
  return new shopify.session.Session({
    id: `${shop}_${Date.now()}`,
    shop,
    state: "state",
    isOnline: false,
    accessToken,
  });
}
