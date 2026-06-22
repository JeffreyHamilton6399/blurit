"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TextRegion } from "@/lib/blurit/types";

interface TextBadgeProps {
  region: TextRegion;
  naturalWidth: number;
  naturalHeight: number;
  onToggle: (id: string) => void;
  className?: string;
}

/**
 * Rectangular overlay for a detected text/plate region. Dashed amber border
 * when unblurred, solid emerald + check when blurred. Shows the recognized
 * text snippet as a small label tag.
 */
export function TextBadge({
  region,
  naturalWidth,
  naturalHeight,
  onToggle,
  className,
}: TextBadgeProps) {
  const leftPct = (region.x / naturalWidth) * 100;
  const topPct = (region.y / naturalHeight) * 100;
  const wPct = (region.width / naturalWidth) * 100;
  const hPct = (region.height / naturalHeight) * 100;

  return (
    <button
      type="button"
      aria-label={
        region.blurred
          ? `Text "${region.label}" — blurred. Tap to reveal.`
          : `Text "${region.label}" — detected. Tap to blur.`
      }
      aria-pressed={region.blurred}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(region.id);
      }}
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${wPct}%`,
        height: `${hPct}%`,
      }}
      className={cn(
        "pointer-events-auto absolute rounded-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-500",
        region.blurred
          ? "border-2 border-emerald-500 bg-emerald-500/10 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]"
          : "border-2 border-dashed border-amber-500 bg-amber-500/[0.06] shadow-[0_0_0_2px_rgba(245,158,11,0.12)] animate-pulse",
        className,
      )}
    >
      <span
        className={cn(
          "absolute -top-2 left-1 flex max-w-[120px] items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm",
          region.blurred ? "bg-emerald-500" : "bg-amber-500",
        )}
      >
        {region.blurred ? <Check className="size-2.5 shrink-0" /> : null}
        <span className="truncate">{region.label || "text"}</span>
      </span>
    </button>
  );
}
