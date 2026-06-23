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

interface EditorSidebarProps {
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

/** Icon for each tool option. */
const TOOL_ICONS: Record<Tool, React.ReactNode> = {
  select: <MousePointerClick className="size-5" />,
  brush: <Brush className="size-5" />,
  erase: <Eraser className="size-5" />,
};

const TOOL_LABELS: Record<Tool, string> = {
  select: "Tap",
  brush: "Brush",
  erase: "Erase",
};

const STYLE_ICONS: Record<BlurType, React.ReactNode> = {
  pixelate: <Grid2x2 className="size-5" />,
  gaussian: <CircleSlash className="size-5" />,
  black: <Square className="size-5" />,
};

const STYLE_LABELS: Record<BlurType, string> = {
  pixelate: "Pixelate",
  gaussian: "Blur",
  black: "Black",
};

const TOOL_CYCLE: Tool[] = ["select", "brush", "erase"];
const STYLE_CYCLE: BlurType[] = ["pixelate", "gaussian", "black"];
const INTENSITY_CYCLE: BlurIntensity[] = ["light", "medium", "heavy"];

/**
 * Vertical icon-only sidebar. Each control is a single icon button that
 * cycles through its options on click. Tooltips show the current option.
 */
function CycleIconButton<T extends string>({
  icons,
  labels,
  cycle,
  value,
  onCycle,
  ariaLabel,
}: {
  icons: Record<T, React.ReactNode>;
  labels: Record<T, string>;
  cycle: T[];
  value: T;
  onCycle: (next: T) => void;
  ariaLabel: string;
}) {
  const currentIndex = cycle.indexOf(value);
  const nextIndex = (currentIndex + 1) % cycle.length;
  const current = labels[value];
  const next = labels[cycle[nextIndex]];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onCycle(cycle[nextIndex])}
          aria-label={`${ariaLabel}: ${current}. Click for ${next}.`}
          className="flex size-10 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {icons[value]}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {current} <span className="text-muted-foreground">→ {next}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function EditorSidebar(props: EditorSidebarProps) {
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
    <div className="flex w-14 shrink-0 flex-col items-center gap-2 border-r py-2">
      {/* 3 cycle buttons — icon only */}
      <CycleIconButton
        icons={TOOL_ICONS}
        labels={TOOL_LABELS}
        cycle={TOOL_CYCLE}
        value={tool}
        onCycle={setTool}
        ariaLabel="Tool"
      />

      {/* Brush shape — only when brushing */}
      {tool === "brush" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() =>
                setBrushShape(brushShape === "rect" ? "ellipse" : "rect")
              }
              aria-label={`Shape: ${brushShape === "rect" ? "rectangle" : "oval"}. Click to switch.`}
              className="flex size-10 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {brushShape === "rect" ? (
                <Square className="size-5" />
              ) : (
                <Circle className="size-5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {brushShape === "rect" ? "Rectangle" : "Oval"}
          </TooltipContent>
        </Tooltip>
      )}

      <CycleIconButton
        icons={STYLE_ICONS}
        labels={STYLE_LABELS}
        cycle={STYLE_CYCLE}
        value={blurType}
        onCycle={setBlurType}
        ariaLabel="Style"
      />

      {/* Strength — dots icon that changes with intensity */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => {
              const idx = INTENSITY_CYCLE.indexOf(intensity);
              setIntensity(INTENSITY_CYCLE[(idx + 1) % INTENSITY_CYCLE.length]);
            }}
            aria-label={`Strength: ${intensity}. Click to cycle.`}
            className="flex size-10 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <span className="flex items-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "size-1.5 rounded-full",
                    i <= INTENSITY_CYCLE.indexOf(intensity)
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/30",
                  )}
                />
              ))}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {intensity} <span className="capitalize">strength</span>
        </TooltipContent>
      </Tooltip>

      <div className="my-1 h-px w-8 bg-border" />

      {/* Blur all */}
      {canBlurAll && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onBlurAll}
              aria-label="Blur all detected regions"
              className="flex size-10 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Sparkles className="size-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Blur all</TooltipContent>
        </Tooltip>
      )}

      {/* Clear manual */}
      {manualCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClearManual}
              aria-label="Clear manual blur boxes"
              className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Eraser className="size-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Clear boxes</TooltipContent>
        </Tooltip>
      )}

      {/* New photo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onNew}
            aria-label="Open a new photo"
            className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Plus className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">New photo</TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      {/* Status (compact, below) */}
      <div className="flex flex-col items-center gap-1 pb-1">
        {detecting ? (
          <Loader2 className="size-4 animate-spin text-emerald-500" />
        ) : (
          (faceCount > 0 || textCount > 0) && (
            <span className="size-1.5 rounded-full bg-emerald-500" />
          )
        )}
        {(faceCount > 0 || textCount > 0 || manualCount > 0) && (
          <span className="text-[9px] leading-tight text-muted-foreground">
            {faceCount > 0 && `${faceCount}f`}
            {textCount > 0 && ` ${textCount}t`}
            {manualCount > 0 && ` ${manualCount}m`}
          </span>
        )}
      </div>

      {/* Download — bottom */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            aria-label="Download protected photo"
            className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-600/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Download className="size-5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Download</TooltipContent>
      </Tooltip>
    </div>
  );
}
