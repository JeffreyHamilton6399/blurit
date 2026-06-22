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
  Circle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type {
  BlurIntensity,
  BlurType,
  RegionShape,
  Tool,
} from "@/lib/blurit/types";

interface EditorToolbarProps {
  tool: Tool;
  setTool: (t: Tool) => void;
  blurType: BlurType;
  setBlurType: (t: BlurType) => void;
  intensity: BlurIntensity;
  setIntensity: (i: BlurIntensity) => void;
  brushShape: RegionShape;
  setBrushShape: (s: RegionShape) => void;
  onDownload: () => void;
  onNew: () => void;
  onClearManual: () => void;
  onBlurAll: () => void;
  canBlurAll: boolean;
  faceCount: number;
  blurredFaceCount: number;
  textCount: number;
  blurredTextCount: number;
  manualCount: number;
  detectionNote: string;
  detecting: boolean;
  downloading: boolean;
}

interface CycleOption<T extends string> {
  value: T;
  label: string;
  icon: React.ReactNode;
}

/**
 * A single button that cycles through its options on click. Shows the current
 * option's icon + label, plus a row of dots indicating position in the cycle.
 */
function CycleButton<T extends string>({
  options,
  value,
  onCycle,
  ariaLabel,
}: {
  options: CycleOption<T>[];
  value: T;
  onCycle: (next: T) => void;
  ariaLabel: string;
}) {
  const currentIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options[currentIndex];
  const nextIndex = (currentIndex + 1) % options.length;

  const handleClick = () => onCycle(options[nextIndex].value);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          aria-label={`${ariaLabel}: ${current.label}. Click for ${options[nextIndex].label}.`}
          className="group flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
        >
          <span className="text-foreground/80">{current.icon}</span>
          <span className="min-w-[2.5rem] text-left">{current.label}</span>
          {/* dot indicators */}
          <span className="flex items-center gap-0.5 pl-0.5">
            {options.map((o, i) => (
              <span
                key={o.value}
                className={cn(
                  "size-1 rounded-full transition-colors",
                  i === currentIndex
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/30",
                )}
              />
            ))}
          </span>
          <ChevronRight className="size-3 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {ariaLabel} — {current.label} (click for {options[nextIndex].label})
      </TooltipContent>
    </Tooltip>
  );
}

const TOOL_OPTIONS: CycleOption<Tool>[] = [
  { value: "select", label: "Tap", icon: <MousePointerClick className="size-4" /> },
  { value: "brush", label: "Brush", icon: <Brush className="size-4" /> },
  { value: "erase", label: "Erase", icon: <Eraser className="size-4" /> },
];

const STYLE_OPTIONS: CycleOption<BlurType>[] = [
  { value: "pixelate", label: "Pixelate", icon: <Grid2x2 className="size-4" /> },
  { value: "gaussian", label: "Blur", icon: <CircleSlash className="size-4" /> },
  { value: "black", label: "Black", icon: <Square className="size-4" /> },
];

const STRENGTH_OPTIONS: CycleOption<BlurIntensity>[] = [
  { value: "light", label: "Light", icon: <span className="text-xs">●</span> },
  { value: "medium", label: "Med", icon: <span className="text-xs">●●</span> },
  { value: "heavy", label: "Heavy", icon: <span className="text-xs">●●●</span> },
];

export function EditorToolbar(props: EditorToolbarProps) {
  const {
    tool,
    setTool,
    blurType,
    setBlurType,
    intensity,
    setIntensity,
    brushShape,
    setBrushShape,
    onDownload,
    onNew,
    onClearManual,
    onBlurAll,
    canBlurAll,
    faceCount,
    blurredFaceCount,
    textCount,
    blurredTextCount,
    manualCount,
    detectionNote,
    detecting,
    downloading,
  } = props;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* 3 cycle buttons — the entire control surface */}
        <CycleButton
          options={TOOL_OPTIONS}
          value={tool}
          onCycle={setTool}
          ariaLabel="Tool"
        />
        <CycleButton
          options={STYLE_OPTIONS}
          value={blurType}
          onCycle={setBlurType}
          ariaLabel="Blur style"
        />
        <CycleButton
          options={STRENGTH_OPTIONS}
          value={intensity}
          onCycle={setIntensity}
          ariaLabel="Strength"
        />

        {/* Brush shape — tiny contextual toggle, only when brushing */}
        {tool === "brush" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() =>
                  setBrushShape(brushShape === "rect" ? "ellipse" : "rect")
                }
                aria-label={`Brush shape: ${brushShape === "rect" ? "rectangle" : "oval"}. Click to switch.`}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {brushShape === "rect" ? (
                  <Square className="size-4" />
                ) : (
                  <Circle className="size-4" />
                )}
                <span className="text-xs">
                  {brushShape === "rect" ? "Rect" : "Oval"}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Shape: {brushShape === "rect" ? "Rectangle" : "Oval"} (click to
              switch)
            </TooltipContent>
          </Tooltip>
        )}

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
                className="size-9"
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
            className="h-9 gap-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-600/90"
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
          {detecting ? (
            <Loader2 className="size-3 animate-spin text-emerald-500" />
          ) : (
            <span
              className={cn(
                "size-1.5 rounded-full",
                faceCount > 0 || textCount > 0
                  ? "bg-emerald-500"
                  : "bg-amber-500",
              )}
            />
          )}
          {detectionNote}
        </span>
        {(faceCount > 0 || textCount > 0 || manualCount > 0) && (
          <>
            <span className="text-border">·</span>
            <span className="flex items-center gap-2">
              {faceCount > 0 && (
                <span>
                  {faceCount} face{faceCount > 1 ? "s" : ""}
                  {blurredFaceCount > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {" "}
                      · {blurredFaceCount} blurred
                    </span>
                  )}
                </span>
              )}
              {textCount > 0 && (
                <span>
                  {textCount} text{textCount > 1 ? "s" : ""}
                  {blurredTextCount > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {" "}
                      · {blurredTextCount} blurred
                    </span>
                  )}
                </span>
              )}
              {manualCount > 0 && (
                <span>
                  {manualCount} manual box{manualCount > 1 ? "es" : ""}
                </span>
              )}
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
            Blur all
          </Button>
        )}
      </div>
    </div>
  );
}
