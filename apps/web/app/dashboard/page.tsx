import dynamic from "next/dynamic";
import { PrismaClient } from "@prisma/client";
const LogsTable = dynamic(() => import("@/components/dashboard/LogsTable"), { ssr: false });
const WebhooksHealth = dynamic(() => import("@/components/dashboard/WebhooksHealth"), { ssr: false });
const Parallax = dynamic(() => import("@/components/visuals/parallax").then(m => m.Parallax), { ssr: false });
const Layer = dynamic(() => import("@/components/visuals/parallax").then(m => m.Layer), { ssr: false });

const prisma = new PrismaClient();

export default async function Dashboard() {
  const shop = await prisma.shop.findFirst();
  const shopDomain = shop?.shop;
  const logs = await prisma.log.findMany({ where: shopDomain ? { shop: shopDomain } : {}, orderBy: { createdAt: 'desc' }, take: 10 });
  const today = new Date(); today.setHours(0,0,0,0);
  const todayCount = await prisma.log.count({ where: { createdAt: { gte: today }, ...(shopDomain ? { shop: shopDomain } : {}) } });
  const sample = await prisma.log.findMany({ where: shopDomain ? { shop: shopDomain } : {}, orderBy: { createdAt: 'desc' }, take: 50 });
  const okCount = sample.filter(l=>l.ok).length;
  const successRate = sample.length ? Math.round((okCount / sample.length)*100) : null;

  return (
    <div className="space-y-8 relative">
      <div className="beam-wrap"><div className="beam" /></div>
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 muted">Track installs, captions, and billing at a glance.</p>
      </div>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="tilt">
          <p className="text-sm muted">Images captioned (today)</p>
          <p className="mt-2 text-3xl font-semibold">{todayCount}</p>
        </Card>
        <Card className="tilt">
          <p className="text-sm muted">Success rate</p>
          <p className="mt-2 text-3xl font-semibold">{successRate !== null ? `${successRate}%` : '—'}</p>
        </Card>
        <Card className="tilt">
          <p className="text-sm muted">Plan</p>
          <p className="mt-2 text-3xl font-semibold">{shop?.plan ?? 'Trial'}</p>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 tilt relative overflow-hidden">
          <Parallax>
            <Layer depth={0.015} className="pointer-events-none absolute -right-8 -top-6 h-24 w-24 rounded-full bg-brand-500/20 blur-xl" />
            <Layer depth={-0.01} className="pointer-events-none absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-indigo-500/10 blur-xl" />
          </Parallax>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent activity</h2>
            <a className="text-sm link" href="#">View all</a>
          </div>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
            {(logs.length ? logs : Array.from({ length: 5 }).map((_,i)=>({id:String(i), productId:String(1000+i), imageId:String(1000+i), alt:'—', shop:'', ok:true, createdAt:new Date()}))).map((log) => (
              <li key={log.id} className="py-3 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">Caption generated</span> for product image <span className="font-mono text-xs">#{log.imageId}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="tilt relative">
          <Parallax>
            <Layer depth={0.02} className="pointer-events-none absolute right-6 top-6 h-14 w-14 rounded-full bg-brand-500/20 blur-lg" />
          </Parallax>
          <h2 className="text-lg font-semibold">Get started</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
            <li>Install the app to your Shopify store</li>
            <li>Create or update a product with images</li>
            <li>See alt text appear automatically</li>
          </ol>
          <Button href="/api/shopify/install?shop=YOUR_SHOP.myshopify.com" className="mt-4 w-full">Install to store</Button>
          <Button href="/billing" variant="ghost" className="mt-2 w-full">Manage billing</Button>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <WebhooksHealth shop={shopDomain || undefined} />
        </Card>
        <Card className="lg:col-span-2">
          <h3 className="text-lg font-semibold">Recent logs</h3>
          <LogsTable shop={shopDomain || undefined} />
        </Card>
      </section>
    </div>
  );
}
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
