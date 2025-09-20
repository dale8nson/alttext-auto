import { cn } from "@/lib/cn";
import React from "react";

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> & {
  href?: string;
  variant?: "primary" | "ghost";
  className?: string;
};

export function Button({ href, variant = "primary", className, children, disabled, ...props }: ButtonProps) {
  const base = "btn";
  const style = variant === "primary" ? "btn-primary" : "btn-ghost";
  const cls = cn(base, style, className);
  if (href && !disabled) {
    return (
      <a href={href} className={cls} {...(props as any)}>
        {children}
      </a>
    );
  }
  // Render as a real button when disabled (or no href) for proper accessibility
  return (
    <button className={cls} disabled={disabled} aria-disabled={disabled ? true : undefined} {...props}>
      {children}
    </button>
  );
}
