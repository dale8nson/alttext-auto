"use client";
import ThemeToggle from "@/components/theme-toggle";
import FxToggle from "@/components/fx-toggle";
import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <FxToggle />
        </div>
        <p className="mt-3 text-sm muted">Your preferences are saved to this browser and apply site‑wide.</p>
      </Card>
    </div>
  );
}

