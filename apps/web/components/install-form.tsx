"use client";

import { useState, useCallback } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { buildInstallPath, normalizeShopDomain } from "@/lib/shop-domain";

interface InstallFormProps {
  initialShop?: string;
}

export function InstallForm({ initialShop }: InstallFormProps) {
  const [shop, setShop] = useState(initialShop ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalized = normalizeShopDomain(shop);
      if (!normalized) {
        setError("Enter your Shopify store (example: candleshop.myshopify.com)");
        return;
      }
      setError(null);
      setIsSubmitting(true);
      const target = buildInstallPath(normalized);
      window.location.href = target;
    },
    [shop]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="shop" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Shopify store domain
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="shop"
            name="shop"
            type="text"
            autoComplete="off"
            placeholder="candleshop.myshopify.com"
            value={shop}
            onChange={(event) => {
              setError(null);
              setShop(event.target.value);
            }}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Redirecting…" : "Install"}
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Need help finding it? Use the format <code>storename.myshopify.com</code> or copy it from your Shopify admin URL.
      </p>
    </form>
  );
}
