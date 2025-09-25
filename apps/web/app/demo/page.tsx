import { Card } from "@/components/ui/card";
import { InstallButton } from "@/components/install-button";
import { Button } from "@/components/ui/button";

const SAMPLE_LOGS = [
  {
    id: "log_1",
    product: "Essential Cotton Tee",
    image: "hero-front.jpg",
    alt: "White cotton t-shirt neatly folded on a wooden table",
    status: "Success",
    time: "2 mins ago"
  },
  {
    id: "log_2",
    product: "Handmade Soy Candle",
    image: "amber-jar.png",
    alt: "Amber glass candle with eucalyptus leaves beside it",
    status: "Success",
    time: "12 mins ago"
  },
  {
    id: "log_3",
    product: "Gradient Yoga Mat",
    image: "mat-detail.png",
    alt: "Purple and teal yoga mat rolled halfway open",
    status: "Updated",
    time: "28 mins ago"
  }
];

export const metadata = {
  title: "Live Demo",
  description: "Preview how AltText Auto captions product images in real time."
};

export default function DemoPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-3xl font-semibold">See AltText Auto in action</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300 max-w-2xl">
          This interactive preview uses sample data to show what merchants experience after installing the app. The
          production dashboard connects directly to Shopify, listens for product events, and writes WCAG-compliant alt
          text back to each product image.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <InstallButton>Install to your store</InstallButton>
          <Button href="/api/shopify/install?shop=demo-store.myshopify.com" variant="ghost">
            Try the OAuth flow (demo store)
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <p className="text-sm uppercase tracking-wide text-slate-500">Images captioned (24h)</p>
          <p className="mt-3 text-4xl font-semibold">382</p>
          <p className="mt-2 text-sm text-slate-500">Products and variants published in the last day</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm uppercase tracking-wide text-slate-500">Accuracy</p>
          <p className="mt-3 text-4xl font-semibold">98%</p>
          <p className="mt-2 text-sm text-slate-500">Alt text passes manual QA and accessibility checks</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm uppercase tracking-wide text-slate-500">Time saved</p>
          <p className="mt-3 text-4xl font-semibold">6h</p>
          <p className="mt-2 text-sm text-slate-500">Estimated time saved daily vs. manual captioning</p>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold">How the automation works</h2>
          <ol className="mt-4 space-y-3 text-slate-600 dark:text-slate-300">
            <li><strong>1.</strong> Detect new or updated product images via Shopify webhooks.</li>
            <li><strong>2.</strong> Send the image to the caption worker for AI-generated alt text.</li>
            <li><strong>3.</strong> Store the event in the dashboard so merchants can review outcomes.</li>
            <li><strong>4.</strong> Write the alt text back to Shopify automatically within seconds.</li>
          </ol>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold">What merchants can configure</h2>
          <ul className="mt-4 space-y-2 text-slate-600 dark:text-slate-300">
            <li>• Toggle captioning per sales channel</li>
            <li>• Set fallback copy or enforce brand voice prompts</li>
            <li>• Inspect logs, retry failed captions, and export audit history</li>
            <li>• Receive weekly accessibility summaries via email</li>
          </ul>
        </Card>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Recent caption activity</h2>
            <p className="text-sm text-slate-500">Sample events from a fashion & lifestyle merchant</p>
          </div>
          <InstallButton variant="ghost">Start your trial</InstallButton>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Product</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Image</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Generated alt text</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Status</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {SAMPLE_LOGS.map((log) => (
                <tr key={log.id} className="align-top">
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{log.product}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.image}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{log.alt}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/60">
        <h2 className="text-2xl font-semibold">Ready to make every product more accessible?</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Install AltText Auto on a development store to test the full workflow end-to-end.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <InstallButton>Install to Shopify</InstallButton>
          <Button href="https://alttext.auto/docs" variant="ghost">
            View developer docs
          </Button>
        </div>
      </section>
    </div>
  );
}
