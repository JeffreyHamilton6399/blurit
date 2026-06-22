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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
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

/** A segmented-control "pod": muted rounded container, active item raised. */
function Group({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={onValueChange}
        size="sm"
        variant="outline"
        className="gap-0.5 rounded-lg border-none bg-muted p-0.5 shadow-none"
      >
        {children}
      </ToggleGroup>
    </div>
  );
}

/** Pod item: flat in the muted container, raised white when active. */
function Item({
  value,
  ariaLabel,
  children,
}: {
  value: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <ToggleGroupItem
      value={value}
      aria-label={ariaLabel}
      variant="outline"
      className={cn(
        "h-7 min-w-7 gap-1 rounded-md border-none bg-transparent px-2 text-xs font-medium shadow-none",
        "hover:bg-background/60",
        "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
      )}
    >
      {children}
    </ToggleGroupItem>
  );
}

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

  const setToolSafe = (v: string) => v && setTool(v as Tool);
  const setBlurTypeSafe = (v: string) => v && setBlurType(v as BlurType);
  const setIntensitySafe = (v: string) => v && setIntensity(v as BlurIntensity);
  const setBrushShapeSafe = (v: string) =>
    v && setBrushShape(v as RegionShape);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        {/* Tool */}
        <Group label="Tool" value={tool} onValueChange={setToolSafe}>
          <Item value="select" ariaLabel="Select / tap regions">
            <MousePointerClick className="size-4" />
            <span className="hidden sm:inline">Tap</span>
          </Item>
          <Item value="brush" ariaLabel="Draw blur box">
            <Brush className="size-4" />
            <span className="hidden sm:inline">Brush</span>
          </Item>
          <Item value="erase" ariaLabel="Erase blur">
            <Eraser className="size-4" />
            <span className="hidden sm:inline">Erase</span>
          </Item>
        </Group>

        {/* Brush shape — only when brushing */}
        {tool === "brush" && (
          <Group
            label="Shape"
            value={brushShape}
            onValueChange={setBrushShapeSafe}
          >
            <Item value="rect" ariaLabel="Rectangle brush">
              <Square className="size-4" />
            </Item>
            <Item value="ellipse" ariaLabel="Oval brush">
              <Circle className="size-4" />
            </Item>
          </Group>
        )}

        {/* Blur type */}
        <Group label="Style" value={blurType} onValueChange={setBlurTypeSafe}>
          <Item value="pixelate" ariaLabel="Pixelate">
            <Grid2x2 className="size-4" />
            <span className="hidden md:inline">Pixelate</span>
          </Item>
          <Item value="gaussian" ariaLabel="Gaussian blur">
            <CircleSlash className="size-4" />
            <span className="hidden md:inline">Blur</span>
          </Item>
          <Item value="black" ariaLabel="Black box">
            <Square className="size-4" />
            <span className="hidden md:inline">Black</span>
          </Item>
        </Group>

        {/* Intensity */}
        <Group
          label="Strength"
          value={intensity}
          onValueChange={setIntensitySafe}
        >
          <Item value="light" ariaLabel="Light intensity">
            Light
          </Item>
          <Item value="medium" ariaLabel="Medium intensity">
            Med
          </Item>
          <Item value="heavy" ariaLabel="Heavy intensity">
            Heavy
          </Item>
        </Group>

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
