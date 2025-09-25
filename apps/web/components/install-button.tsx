"use client";

import { useCallback } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
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
  const handleClick = useCallback(() => {
    const installPath = buildInstallPath(shop);

    if (installPath === "/install") {
      const prefill = buildInstallPrefill(shop);
      const query = prefill ? `?shop=${encodeURIComponent(prefill)}` : "";
      window.location.href = `/install${query}`;
      return;
    }

    window.location.href = installPath;
  }, [shop]);

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
