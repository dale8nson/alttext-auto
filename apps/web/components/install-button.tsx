"use client";

import { useCallback } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buildInstallPath, buildInstallPrefill } from "@/lib/shop-domain";

interface InstallButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children?: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
  shop?: string | null;
}

export function InstallButton({
  children = "Install to store",
  variant = "primary",
  className,
  shop,
  ...buttonProps
}: InstallButtonProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleClick = useCallback(() => {
    const shopFromQuery = shop ?? searchParams?.get("shop") ?? "";
    const installPath = buildInstallPath(shopFromQuery);

    if (installPath === "/install") {
      const prefill = buildInstallPrefill(shopFromQuery);
      const query = prefill ? `?shop=${encodeURIComponent(prefill)}` : "";
      router.push(`/install${query}`);
      return;
    }

    window.location.href = installPath;
  }, [router, searchParams, shop]);

  const { type, ...restProps } = buttonProps;

  return (
    <Button
      type={type ?? "button"}
      variant={variant}
      className={className}
      onClick={handleClick}
      {...restProps}
    >
      {children}
    </Button>
  );
}
