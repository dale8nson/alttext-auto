import "./globals.css";
import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { InstallButton } from "@/components/install-button";
import type { Metadata, Viewport } from "next";
const ThemeToggle = dynamic(() => import("../components/theme-toggle"), { ssr: false });
const BackgroundFX = dynamic(() => import("@/components/visuals/background-fx"), { ssr: false });
const Sparkles = dynamic(() => import("@/components/visuals/sparkles"), { ssr: false });
const FxToggle = dynamic(() => import("@/components/fx-toggle"), { ssr: false });
const StickyCta = dynamic(() => import("@/components/sticky-cta"), { ssr: false });
const TrialRibbon = dynamic(() => import("@/components/trial-ribbon"), { ssr: false });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SHOPIFY_APP_URL || "http://localhost:3000"),
  title: {
    default: "AltText Auto — Automatic Alt Text for Shopify",
    template: "%s | AltText Auto",
  },
  description:
    "Generate WCAG-compliant, SEO‑friendly alt text for Shopify product images automatically. Improve accessibility, rankings, and conversions.",
  keywords: [
    "Shopify alt text",
    "WCAG accessibility",
    "SEO image alt",
    "ecommerce accessibility",
    "automatic captions",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "AltText Auto — Automatic Alt Text for Shopify",
    description:
      "Generate WCAG‑friendly alt text for Shopify product images automatically.",
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "AltText Auto preview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AltText Auto — Automatic Alt Text for Shopify",
    description:
      "Generate WCAG‑friendly alt text for Shopify product images automatically.",
    images: ["/og.svg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1a" },
  ],
};

function Header() {
  return (
    <header className="app-header sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70" role="navigation" aria-label="Primary">
      <Container className="flex h-14 items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-slate-800">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">A</span>
          <span className="font-semibold dark:text-slate-100">AltText Auto</span>
        </a>
        <nav className="flex items-center gap-2" aria-label="Primary actions">
          <Button href="/demo" variant="ghost">Demo</Button>
          <Button href="/dashboard" variant="ghost">Dashboard</Button>
          <InstallButton>Install</InstallButton>
          <Button href="/settings" variant="ghost">Settings</Button>
          <FxToggle />
          <ThemeToggle />
        </nav>
      </Container>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 py-8">
      <div className="container-page flex items-center justify-between text-sm text-slate-500">
        <p>© {new Date().getFullYear()} AltText Auto</p>
        <div className="flex gap-4">
          <a href="#" className="hover:text-slate-700">Privacy</a>
          <a href="#" className="hover:text-slate-700">Terms</a>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var s = localStorage.getItem('theme');
              // Default to dark unless explicitly set to light
              if (s !== 'light') document.documentElement.classList.add('dark');
              // Apply FX preference (default on)
              var fx = localStorage.getItem('fx');
              if (fx === 'off') document.documentElement.classList.add('fx-off');
            } catch(e){}
          })();
        `}} />
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'AltText Auto',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description: 'Generate WCAG-compliant, SEO-friendly alt text for Shopify product images automatically.',
            url: process.env.SHOPIFY_APP_URL || 'http://localhost:3000',
            offers: {
              '@type': 'Offer',
              price: '9',
              priceCurrency: 'USD'
            },
            publisher: {
              '@type': 'Organization',
              name: 'AltText Auto'
            }
          }) }} />
      </head>
      <body className="dark:text-slate-100">
        <a href="#content" className="skip-link">Skip to content</a>
        <BackgroundFX />
        <div className="fx-noise" aria-hidden />
        <Sparkles />
        <Header />
        <TrialRibbon />
        <StickyCta />
        <main id="content">
          <Container className="py-10">{children}</Container>
        </main>
        <Footer />
      </body>
    </html>
  );
}
