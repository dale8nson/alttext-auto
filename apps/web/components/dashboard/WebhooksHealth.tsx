"use client";
import { useEffect, useState } from "react";

type WH = { id: number; topic: string; address: string };

export default function WebhooksHealth({ shop }: { shop?: string }) {
  const [hooks, setHooks] = useState<WH[]>([]);
  const [loading, setLoading] = useState(false);
  const need = new Set(["products/create", "products/update"]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/shopify/webhooks${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`, { cache: 'no-store' });
      const data = await res.json();
      setHooks(data?.webhooks || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [shop]);

  const ok = hooks.some(h => need.has(h.topic));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Webhooks health</h3>
        <button className="btn btn-ghost" onClick={load} disabled={loading}>{loading ? 'Checking…' : 'Refresh'}</button>
      </div>
      <p className="mt-1 text-sm {ok ? 'text-green-600' : 'text-amber-600'}">{ok ? 'Active' : 'Missing'}</p>
      <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
        {hooks.map(h => (
          <li key={h.id} className="flex items-center justify-between">
            <span>{h.topic}</span>
            <span className="font-mono text-xs truncate max-w-[40ch]" title={h.address}>{h.address}</span>
          </li>
        ))}
        {!hooks.length && <li className="muted">No webhooks found for this shop.</li>}
      </ul>
    </div>
  );
}

