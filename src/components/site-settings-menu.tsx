"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { FileText, Github, Moon, Settings, ShieldCheck, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LegalDialog, type LegalKind } from "@/components/site-legal";

const GITHUB_URL = "https://github.com/JeffreyHamilton6399/blurit";

/**
 * The gear menu every tool shares. Apps with their own settings pass them in
 * as `children`; they render directly under the theme toggle, above Legal.
 */
export function SiteSettingsMenu({ children }: { children?: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [legal, setLegal] = React.useState<LegalKind | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  // Close the menu before opening a dialog, or the two overlays fight over
  // focus and the dialog opens behind the dropdown.
  const openLegal = (kind: LegalKind) => {
    setOpen(false);
    setLegal(kind);
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
            {isDark ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            {isDark ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>

          {children}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Legal
          </DropdownMenuLabel>

          <DropdownMenuItem onClick={() => openLegal("privacy")}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Privacy Policy
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openLegal("terms")}>
            <FileText className="mr-2 h-4 w-4" />
            Terms of Service
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LegalDialog
        kind={legal ?? "privacy"}
        open={legal !== null}
        onOpenChange={(v) => !v && setLegal(null)}
      />
    </>
  );
}
