"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [shop, setShop] = useState("");

  useEffect(() => {
    const ls = typeof window !== 'undefined' ? localStorage.getItem('shop_domain') : null;
    if (ls) setShop(ls);
    fetch('/api/shop').then(r=>r.json()).then(d=>{
      if (!ls && d?.shop?.shop) setShop(d.shop.shop);
    }).catch(()=>{});
  }, []);

  async function start(priceId: string) {
    try {
      setLoading(priceId);
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop, priceId }),
      });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  const plans = [
    { name: "Starter", id: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER || "price_starter" },
    { name: "Growth", id: process.env.NEXT_PUBLIC_STRIPE_PRICE_GROWTH || "price_growth" },
    { name: "Pro", id: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || "price_pro" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <div className="flex items-end gap-2">
        <div>
          <label className="block text-sm muted">Shop domain</label>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            placeholder="your-store.myshopify.com"
            value={shop}
            onChange={e=>{ setShop(e.target.value); if (typeof window!=='undefined') localStorage.setItem('shop_domain', e.target.value); }}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map(p => (
          <Card key={p.name} className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">{p.name}</div>
              <div className="muted text-sm">Recurring monthly subscription</div>
            </div>
            <Button onClick={() => start(p.id)} disabled={loading === p.id}>Choose</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
