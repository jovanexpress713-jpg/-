import type { ReactNode } from "react";
import { cn } from "../utils/cn";

function StatusIcons() {
  return (
    <svg width="62" height="12" viewBox="0 0 62 12" fill="none" aria-hidden="true">
      <rect x="0" y="7" width="3" height="5" rx="1" fill="currentColor" />
      <rect x="5" y="5" width="3" height="7" rx="1" fill="currentColor" />
      <rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" />
      <rect x="15" y="1" width="3" height="11" rx="1" fill="currentColor" />
      <path
        d="M25 4.2a7.5 7.5 0 0 1 10 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M27.6 6.8a4.2 4.2 0 0 1 4.8 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="30" cy="9.4" r="1.2" fill="currentColor" />
      <rect
        x="41"
        y="2"
        width="18"
        height="9"
        rx="2.6"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect x="42.8" y="3.8" width="12" height="5.4" rx="1.4" fill="currentColor" />
      <path
        d="M60.6 4.6v3.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PhoneFrame({
  children,
  tone = "dark",
  className,
  style,
  glow = false,
}: {
  children: ReactNode;
  tone?: "dark" | "light";
  className?: string;
  style?: React.CSSProperties;
  glow?: boolean;
}) {
  const text = tone === "dark" ? "text-white" : "text-navy";
  return (
    <div
      className={cn("relative shrink-0 rounded-[55px] bg-surface-7 p-[7px]", className)}
      style={
        glow
          ? { ...style, boxShadow: "0 50px 90px -40px color-mix(in oklab, var(--color-accent-2) 55%, transparent)" }
          : style
      }
    >
      <div className="relative h-full w-full min-h-[600px] min-w-[286px] overflow-hidden rounded-[46px] bg-surface-0">
        {children}

        {/* dynamic island */}
        <div className="absolute top-[9px] left-1/2 z-40 h-[26px] w-[84px] -translate-x-1/2 rounded-full bg-black" />

        {/* status bar */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-30 flex h-11 items-center justify-between px-6 pt-1 text-[11px] font-semibold tabular-nums",
            text,
          )}
        >
          <span>9:41</span>
          <StatusIcons />
        </div>

        {/* home indicator */}
        <div
          className={cn(
            "pointer-events-none absolute bottom-[7px] left-1/2 z-40 h-[5px] w-[108px] -translate-x-1/2 rounded-full",
            tone === "dark" ? "bg-text-primary/35" : "bg-surface-0/25",
          )}
        />
      </div>
    </div>
  );
}
