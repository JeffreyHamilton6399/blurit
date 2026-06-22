"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Github,
  Settings2,
  FileText,
  Lock,
  Moon,
  Sun,
  ScanFace,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DetectionModes } from "@/lib/blurit/types";

const GITHUB_URL = "https://github.com/JeffreyHamilton6399";
const DONATE_URL = "https://buymeacoffee.com/jeffreyscof";

interface SettingsMenuProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  modes: DetectionModes;
  setModes: (m: DetectionModes) => void;
}

export function SettingsMenu({
  onOpenPrivacy,
  onOpenTerms,
  modes,
  setModes,
}: SettingsMenuProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Settings"
        >
          <Settings2 className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>

        {/* Theme toggle row */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="flex items-center gap-2 text-sm">
            {isDark ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
            Dark mode
          </span>
          <Switch
            checked={isDark}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            aria-label="Toggle dark mode"
          />
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Auto-detect</DropdownMenuLabel>

        {/* Face detection toggle */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="flex items-center gap-2 text-sm">
            <ScanFace className="size-4" />
            Faces
          </span>
          <Switch
            checked={modes.faces}
            onCheckedChange={(checked) =>
              setModes({ ...modes, faces: checked })
            }
            aria-label="Toggle face detection"
          />
        </div>

        {/* Text / plates / documents toggle */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="flex items-center gap-2 text-sm">
            <Type className="size-4" />
            Text &amp; plates
          </span>
          <Switch
            checked={modes.text}
            onCheckedChange={(checked) =>
              setModes({ ...modes, text: checked })
            }
            aria-label="Toggle text and license plate detection"
          />
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenPrivacy}>
          <Lock className="size-4" /> Privacy
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenTerms}>
          <FileText className="size-4" /> Terms
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Github className="size-4" /> GitHub
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { GITHUB_URL, DONATE_URL };
