"use client";

import * as React from "react";
import {
  Brush,
  Download,
  Eraser,
  Grid2x2,
  MousePointerClick,
  Plus,
  Square,
  CircleSlash,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { BlurIntensity, BlurType, Tool } from "@/lib/blurit/types";

interface EditorToolbarProps {
  tool: Tool;
  setTool: (t: Tool) => void;
  blurType: BlurType;
  setBlurType: (t: BlurType) => void;
  intensity: BlurIntensity;
  setIntensity: (i: BlurIntensity) => void;
  onDownload: () => void;
  onNew: () => void;
  onClearManual: () => void;
  onBlurAll: () => void;
  canBlurAll: boolean;
  faceCount: number;
  blurredCount: number;
  manualCount: number;
  detectionNote: string;
  detectionAvailable: boolean;
  downloading: boolean;
}

export function EditorToolbar(props: EditorToolbarProps) {
  const {
    tool,
    setTool,
    blurType,
    setBlurType,
    intensity,
    setIntensity,
    onDownload,
    onNew,
    onClearManual,
    onBlurAll,
    canBlurAll,
    faceCount,
    blurredCount,
    manualCount,
    detectionNote,
    detectionAvailable,
    downloading,
  } = props;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Tool selection */}
        <ToggleGroup
          type="single"
          value={tool}
          onValueChange={(v) => v && setTool(v as Tool)}
          size="sm"
          variant="outline"
        >
          <ToggleGroupItem value="select" aria-label="Select / tap faces">
            <MousePointerClick className="size-4" />
            <span className="hidden sm:inline">Tap</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="brush" aria-label="Draw blur box">
            <Brush className="size-4" />
            <span className="hidden sm:inline">Brush</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="erase" aria-label="Erase blur">
            <Eraser className="size-4" />
            <span className="hidden sm:inline">Erase</span>
          </ToggleGroupItem>
        </ToggleGroup>

        <span className="hidden h-6 w-px bg-border sm:block" />

        {/* Blur type */}
        <ToggleGroup
          type="single"
          value={blurType}
          onValueChange={(v) => v && setBlurType(v as BlurType)}
          size="sm"
          variant="outline"
        >
          <ToggleGroupItem value="pixelate" aria-label="Pixelate">
            <Grid2x2 className="size-4" />
            <span className="hidden md:inline">Pixelate</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="gaussian" aria-label="Gaussian blur">
            <CircleSlash className="size-4" />
            <span className="hidden md:inline">Blur</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="black" aria-label="Black box">
            <Square className="size-4" />
            <span className="hidden md:inline">Black</span>
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Intensity */}
        <ToggleGroup
          type="single"
          value={intensity}
          onValueChange={(v) => v && setIntensity(v as BlurIntensity)}
          size="sm"
          variant="outline"
        >
          <ToggleGroupItem value="light">Light</ToggleGroupItem>
          <ToggleGroupItem value="medium">Med</ToggleGroupItem>
          <ToggleGroupItem value="heavy">Heavy</ToggleGroupItem>
        </ToggleGroup>

        <div className="ml-auto flex items-center gap-1.5">
          {manualCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearManual}
                  className="h-7 text-muted-foreground"
                >
                  <Eraser className="size-3.5" />
                  <span className="hidden lg:inline">Clear boxes</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove all manual blur boxes</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={onNew}
                aria-label="Open a new photo"
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New photo</TooltipContent>
          </Tooltip>
          <Button
            size="sm"
            onClick={onDownload}
            disabled={downloading}
            className="h-8 gap-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-600/90"
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            <span>Download</span>
          </Button>
        </div>
      </div>

      {/* Status line */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {detectionAvailable ? (
            <span className="size-1.5 rounded-full bg-emerald-500" />
          ) : (
            <span className="size-1.5 rounded-full bg-amber-500" />
          )}
          {detectionNote}
        </span>
        {(faceCount > 0 || manualCount > 0) && (
          <>
            <span className="text-border">·</span>
            <span>
              {faceCount > 0 && (
                <>
                  {faceCount} face{faceCount > 1 ? "s" : ""}
                  {blurredCount > 0 && ` · ${blurredCount} blurred`}
                </>
              )}
              {faceCount > 0 && manualCount > 0 && " · "}
              {manualCount > 0 &&
                `${manualCount} manual box${manualCount > 1 ? "es" : ""}`}
            </span>
          </>
        )}
        {canBlurAll && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBlurAll}
            className="ml-auto h-6 gap-1 rounded-full border-emerald-500/40 px-2.5 text-[11px] text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400"
          >
            <Sparkles className="size-3" />
            Blur all faces
          </Button>
        )}
      </div>
    </div>
  );
}
