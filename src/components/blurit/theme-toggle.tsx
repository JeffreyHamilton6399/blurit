"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

/**
 * Single-button theme toggle: shows a sun in dark mode (click → light),
 * a moon in light mode (click → dark). Minimalistic.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {/* keep both mounted to avoid layout shift; hide the inactive one */}
          <Sun
            className={`size-4 transition-all ${
              isDark ? "scale-100 rotate-0" : "scale-0 -rotate-90"
            } absolute`}
          />
          <Moon
            className={`size-4 transition-all ${
              isDark ? "scale-0 rotate-90" : "scale-100 rotate-0"
            }`}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isDark ? "Light mode" : "Dark mode"}
      </TooltipContent>
    </Tooltip>
  );
}
