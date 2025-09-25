import type { Metadata } from "next";
import { InstallForm } from "@/components/install-form";

export const metadata: Metadata = {
  title: "Install the Shopify app",
  description: "Enter your Shopify domain to start the app installation flow.",
};

interface InstallPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function InstallPage({ searchParams }: InstallPageProps) {
  const initialShopParam = searchParams?.shop;
  const initialShop = Array.isArray(initialShopParam) ? initialShopParam[0] : initialShopParam;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Install AltText Auto</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
        Enter your Shopify store domain so we can redirect you to Shopify for authorization. Use the format
        <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">storename.myshopify.com</code>.
      </p>
      <InstallForm initialShop={initialShop ?? undefined} />
    </div>
  );
}
