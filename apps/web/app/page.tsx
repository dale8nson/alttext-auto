import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InstallButton } from "@/components/install-button";
import dynamic from "next/dynamic";
const Parallax = dynamic(() => import("@/components/visuals/parallax").then(m => m.Parallax), { ssr: false });
const Layer = dynamic(() => import("@/components/visuals/parallax").then(m => m.Layer), { ssr: false });

interface HomeProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function Home({ searchParams }: HomeProps) {
  const shopParam = searchParams?.shop;
  const shop = Array.isArray(shopParam) ? shopParam[0] : shopParam;

  return (
    <div className="py-8">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 p-6 md:p-8 text-white shadow-soft hero-panel dark:from-slate-800 dark:to-slate-900">
        <div className="beam-wrap"><div className="beam" /></div>
        <div className="absolute inset-0 rounded-2xl bg-white/10 mix-blend-overlay opacity-60 dark:hidden" aria-hidden />
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold leading-tight animate-fadeUp">Accessible, SEO‑friendly alt text for Shopify — on autopilot</h1>
          <p className="mt-3 text-white/90 animate-fadeUp" style={{animationDelay:'80ms'}}>Ship more inclusive product pages and save time. We detect new product images and generate WCAG‑friendly alt text instantly.</p>
          <div className="mt-6 flex flex-wrap gap-3 animate-fadeUp" style={{animationDelay:'140ms'}}>
            <InstallButton shop={shop}>Install to store</InstallButton>
            <Button href="/dashboard" variant="ghost" className="bg-transparent text-white border-white/30 hover:bg-white/10">View dashboard</Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-float" aria-hidden />
        <Parallax>
          <Layer depth={0.02} className="pointer-events-none absolute -left-8 -bottom-16 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
          <Layer depth={-0.015} className="pointer-events-none absolute right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-xl" />
        </Parallax>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-3">
        <Card>
          <h3 className="text-lg font-semibold">WCAG‑ready out of the box</h3>
          <p className="mt-2 muted">Readable, concise alt text to improve accessibility and search visibility.</p>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold">Zero maintenance</h3>
          <p className="mt-2 muted">Boring tech and automatic updates keep things fast and reliable.</p>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold">Built for speed</h3>
          <p className="mt-2 muted">Captions are generated as products are created or updated.</p>
        </Card>
      </section>

      <section className="mt-12 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-xl font-semibold">Simple pricing</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {[
            { name: "Starter", price: "$9/mo", features: ["Up to 200 images", "Email support"], priceId: "price_starter" },
            { name: "Growth", price: "$29/mo", features: ["Up to 2k images", "Priority support"], priceId: "price_growth" },
            { name: "Pro", price: "$79/mo", features: ["Up to 10k images", "SLA support"], priceId: "price_pro" },
          ].map((p) => (
            <Card key={p.name} className="flex flex-col">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-1 text-2xl font-bold">{p.price}</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600" />
                      <span className="dark:text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button href="/dashboard" className="mt-6">Choose {p.name}</Button>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold">How it works</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-slate-700 dark:text-slate-300">
            <li>Install the app to your Shopify store.</li>
            <li>We listen for product create/update webhooks.</li>
            <li>New images are sent to the caption worker.</li>
            <li>Alt text is written back to Shopify automatically.</li>
          </ol>
        </Card>
        <Card className="flex items-center justify-center">
          <figure className="w-full">
            <img
              src="/dashboard-preview.png"
              alt="Screenshot of the AltText Auto dashboard showing generated alt text"
              className="aspect-[16/9] w-full rounded-lg border border-slate-200 shadow-sm dark:border-slate-700"
            />
            <figcaption className="mt-2 text-center text-sm muted">Example — product image updated with alt text</figcaption>
          </figure>
        </Card>
      </section>

      <section className="mt-12 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-xl font-semibold">Why stores choose AltText Auto</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-block h-2 w-2 rounded-full bg-brand-600" aria-hidden />
            <p className="text-slate-700 dark:text-slate-300">Improves Lighthouse scores and Core Web Vitals by eliminating missing image alt errors.</p>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-block h-2 w-2 rounded-full bg-brand-600" aria-hidden />
            <p className="text-slate-700 dark:text-slate-300">WCAG AA color contrast and accessible UI baked in.</p>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-block h-2 w-2 rounded-full bg-brand-600" aria-hidden />
            <p className="text-slate-700 dark:text-slate-300">No code. No maintenance. Works with existing product workflows.</p>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-block h-2 w-2 rounded-full bg-brand-600" aria-hidden />
            <p className="text-slate-700 dark:text-slate-300">Respects privacy: only image URLs are processed; no customer PII.</p>
          </li>
        </ul>
      </section>

      <section className="mt-12 text-center">
        <h2 className="text-xl font-semibold">Ready to make every product more accessible?</h2>
        <p className="mt-2 muted">Install the app and get a 7‑day free trial.</p>
        <div className="mt-4 flex justify-center">
          <InstallButton shop={shop}>Start free trial</InstallButton>
        </div>
      </section>
    </div>
  );
}
