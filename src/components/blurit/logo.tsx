import * as React from "react";
import { cn } from "@/lib/utils";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  /** show the wordmark next to the mark */
  withText?: boolean;
}

/**
 * Flat BlurIt mark: a face (circle) with a pixelated mosaic block covering
 * the "eye" region — face + blur, instantly readable. No gradients.
 */
export function Logo({ withText = true, className, ...props }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 32 32"
        width={22}
        height={22}
        aria-hidden="true"
        {...props}
      >
        <rect width="32" height="32" rx="8" fill="#10b981" />
        {/* face circle */}
        <circle cx="16" cy="16" r="9.5" fill="none" stroke="#ffffff" strokeWidth="2" />
        {/* pixelated mosaic over the upper face (the "blurred" eyes) */}
        <g fill="#ffffff">
          <rect x="11.5" y="12" width="2.4" height="2.4" rx="0.3" />
          <rect x="13.9" y="12" width="2.4" height="2.4" rx="0.3" />
          <rect x="11.5" y="14.4" width="2.4" height="2.4" rx="0.3" />
          <rect x="13.9" y="14.4" width="2.4" height="2.4" rx="0.3" />
        </g>
        {/* a subtle smile to confirm "face" */}
        <path
          d="M12.5 20c1 1.1 2.2 1.6 3.5 1.6S18.5 21.1 19.5 20"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.85"
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
