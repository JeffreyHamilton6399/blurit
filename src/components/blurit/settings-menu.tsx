"use client";

import * as React from "react";
import { Github, Settings2, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const GITHUB_URL = "https://github.com/JeffreyHamilton6399";
const DONATE_URL = "https://buymeacoffee.com/jeffreyscof";

interface SettingsMenuProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export function SettingsMenu({ onOpenPrivacy, onOpenTerms }: SettingsMenuProps) {
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
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Settings</DropdownMenuLabel>
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
