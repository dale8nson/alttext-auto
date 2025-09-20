"use client";
import { useEffect, useState } from "react";

type Log = {
  id: string;
  shop: string;
  productId: string;
  imageId: string;
  alt: string;
  ok: boolean;
  createdAt: string;
};

export default function LogsTable({ shop }: { shop?: string }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const take = 10;

  async function load(p = 1) {
    const url = `/api/logs?take=${take}&page=${p}${shop ? `&shop=${encodeURIComponent(shop)}` : ''}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    setLogs(data.logs || []);
    setPage(data.page || 1);
    setPages(data.pages || 1);
  }

  useEffect(() => { load(1); }, [shop]);

  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400">
              <th className="py-2">Time</th>
              <th className="py-2">Product</th>
              <th className="py-2">Image</th>
              <th className="py-2">Status</th>
              <th className="py-2">Alt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {logs.map(l => (
              <tr key={l.id} className="text-slate-700 dark:text-slate-300">
                <td className="py-2">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="py-2 font-mono text-xs">{l.productId}</td>
                <td className="py-2 font-mono text-xs">{l.imageId}</td>
                <td className="py-2">{l.ok ? 'OK' : 'Fail'}</td>
                <td className="py-2 truncate max-w-[40ch]" title={l.alt}>{l.alt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button className="btn btn-ghost" onClick={() => load(Math.max(1, page-1))} disabled={page<=1}>Prev</button>
        <span className="text-sm muted">Page {page} / {pages}</span>
        <button className="btn btn-ghost" onClick={() => load(Math.min(pages, page+1))} disabled={page>=pages}>Next</button>
      </div>
    </div>
  );
}

