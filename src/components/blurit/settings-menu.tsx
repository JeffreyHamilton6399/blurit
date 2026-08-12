"use client";

import * as React from "react";
import { ScanFace, Type } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import {
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SiteSettingsMenu } from "@/components/site-settings-menu";
import type { DetectionModes } from "@/lib/blurit/types";

const GITHUB_URL = "https://github.com/JeffreyHamilton6399/blurit";
const DONATE_URL = "https://buymeacoffee.com/jeffreyscof";

interface SettingsMenuProps {
  modes: DetectionModes;
  setModes: (m: DetectionModes) => void;
}

/**
 * The shared gear menu plus BlurIt's own auto-detect toggles. Theme, legal,
 * and GitHub all come from SiteSettingsMenu so this matches the other tools.
 */
export function SettingsMenu({ modes, setModes }: SettingsMenuProps) {
  return (
    <SiteSettingsMenu>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs text-muted-foreground">
        Auto-detect
      </DropdownMenuLabel>

      <ToggleRow
        icon={<ScanFace className="size-4" />}
        label="Faces"
        checked={modes.faces}
        onChange={(v) => setModes({ ...modes, faces: v })}
      />
      <ToggleRow
        icon={<Type className="size-4" />}
        label="Text &amp; plates"
        checked={modes.text}
        onChange={(v) => setModes({ ...modes, text: v })}
      />
    </SiteSettingsMenu>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <span className="flex items-center gap-2 text-sm">
        {icon}
        {label}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label={`Toggle ${label}`}
      />
    </div>
  );
}

export { GITHUB_URL, DONATE_URL };
