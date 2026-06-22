"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Github,
  Heart,
  Moon,
  Settings2,
  Shield,
  Sun,
  Monitor,
  FileText,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DONATE_URL = "https://buymeacoffee.com/jeffreyscof";
const GITHUB_URL = "https://github.com/JeffreyHamilton6399";

interface SettingsMenuProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export function SettingsMenu({ onOpenPrivacy, onOpenTerms }: SettingsMenuProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

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
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mounted ? theme : "system"}
          onValueChange={setTheme}
        >
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
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
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-rose-600 focus:text-rose-600 dark:text-rose-400"
          >
            <Heart className="size-4" /> Buy me a coffee
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DONATE_URL, GITHUB_URL };
