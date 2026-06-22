"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { faceToSquareRegion } from "@/lib/blurit/blur";
import type { FaceRegion } from "@/lib/blurit/types";

interface FaceBadgeProps {
  face: FaceRegion;
  index: number;
  naturalWidth: number;
  naturalHeight: number;
  onToggle: (id: string) => void;
  className?: string;
}

/**
 * Circular overlay for a detected face. Dashed amber ring when unblurred,
 * solid emerald ring + check when blurred. Positioned by percentage so it
 * tracks the displayed image regardless of size.
 */
export function FaceBadge({
  face,
  index,
  naturalWidth,
  naturalHeight,
  onToggle,
  className,
}: FaceBadgeProps) {
  const square = faceToSquareRegion(face);
  const leftPct = (square.x / naturalWidth) * 100;
  const topPct = (square.y / naturalHeight) * 100;
  const sizePct = (square.width / naturalWidth) * 100;

  return (
    <button
      type="button"
      aria-label={
        face.blurred
          ? `Face ${index + 1} — blurred. Tap to reveal.`
          : `Face ${index + 1} — detected. Tap to blur.`
      }
      aria-pressed={face.blurred}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(face.id);
      }}
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${sizePct}%`,
        aspectRatio: "1 / 1",
      }}
      className={cn(
        "absolute rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-500",
        face.blurred
          ? "border-2 border-emerald-500 bg-emerald-500/10 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]"
          : "border-2 border-dashed border-amber-500 bg-amber-500/[0.06] shadow-[0_0_0_2px_rgba(245,158,11,0.12)] animate-pulse",
        className,
      )}
    >
      <span
        className={cn(
          "absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm",
          face.blurred ? "bg-emerald-500" : "bg-amber-500",
        )}
      >
        {face.blurred ? <Check className="size-3" /> : index + 1}
      </span>
    </button>
  );
}
