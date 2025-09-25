export function sanitizeShopInput(value?: string | null): string {
  if (!value) return "";
  let sanitized = value.trim().toLowerCase();
  sanitized = sanitized.replace(/^https?:\/\//, "");
  sanitized = sanitized.replace(/\?.*$/, "");
  sanitized = sanitized.replace(/\/.*/, "");
  return sanitized;
}

export function normalizeShopDomain(value?: string | null): string | null {
  const sanitized = sanitizeShopInput(value);
  if (!sanitized) return null;
  if (sanitized.endsWith(".myshopify.com")) {
    return sanitized;
  }
  if (/^[a-z0-9][a-z0-9-]*$/.test(sanitized)) {
    return `${sanitized}.myshopify.com`;
  }
  return null;
}

export function buildInstallPath(shop?: string | null): string {
  const normalized = normalizeShopDomain(shop);
  if (!normalized) return "/install";
  return `/api/shopify/install?shop=${encodeURIComponent(normalized)}`;
}

export function buildInstallPrefill(shop?: string | null): string {
  const sanitized = sanitizeShopInput(shop);
  return sanitized;
}
