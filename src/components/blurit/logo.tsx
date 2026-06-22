import * as React from "react";
import { cn } from "@/lib/utils";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  /** show the wordmark next to the mark */
  withText?: boolean;
}

/**
 * Flat BlurIt mark: an eye whose pupil is a pixelated mosaic (blurred).
 * No gradients, no decorative blobs.
 */
export function Logo({ withText = true, className, ...props }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 32 32"
        width={24}
        height={24}
        aria-hidden="true"
        {...props}
      >
        <rect width="32" height="32" rx="8" fill="#10b981" />
        <path
          d="M4 16c2.8-4.6 6.9-7 12-7s9.2 2.4 12 7c-2.8 4.6-6.9 7-12 7S6.8 20.6 4 16Z"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <g fill="#ffffff">
          <rect x="13.4" y="11.4" width="2.6" height="2.6" rx="0.4" />
          <rect x="16" y="11.4" width="2.6" height="2.6" rx="0.4" />
          <rect x="13.4" y="14" width="2.6" height="2.6" rx="0.4" />
          <rect x="16" y="14" width="2.6" height="2.6" rx="0.4" />
        </g>
        <circle
          cx="16"
          cy="16"
          r="7.6"
          fill="none"
          stroke="#10b981"
          strokeWidth="1.4"
          strokeDasharray="2 2"
          opacity="0.5"
        />
      </svg>
      {withText && (
        <span className="text-[15px] font-semibold tracking-tight">
          BlurIt
        </span>
      )}
    </span>
  );
}
