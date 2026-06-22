"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { renderComposite, faceToSquareRegion } from "@/lib/blurit/blur";
import type {
  BlurIntensity,
  BlurType,
  FaceRegion,
  LoadedImage,
  ManualRegion,
  Rect,
  RegionShape,
  TextRegion,
  Tool,
} from "@/lib/blurit/types";
import { FaceBadge } from "./face-badge";
import { TextBadge } from "./text-badge";

interface PhotoCanvasProps {
  image: LoadedImage;
  faces: FaceRegion[];
  textRegions: TextRegion[];
  manualRegions: ManualRegion[];
  blurType: BlurType;
  intensity: BlurIntensity;
  tool: Tool;
  brushShape: RegionShape;
  onToggleFace: (id: string) => void;
  onToggleText: (id: string) => void;
  onAddManual: (region: Rect, shape: RegionShape) => void;
  onRemoveManual: (id: string) => void;
  onUnblurFace: (id: string) => void;
  onUnblurText: (id: string) => void;
}

const MAX_WORK = 2048;

interface OverlayBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function PhotoCanvas({
  image,
  faces,
  textRegions,
  manualRegions,
  blurType,
  intensity,
  tool,
  brushShape,
  onToggleFace,
  onToggleText,
  onAddManual,
  onRemoveManual,
  onUnblurFace,
  onUnblurText,
}: PhotoCanvasProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [draft, setDraft] = React.useState<Rect | null>(null);
  const [box, setBox] = React.useState<OverlayBox | null>(null);
  const dragRef = React.useRef<{
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);

  // Working (backing) resolution: cap longest side for performance.
  const { workW, workH } = React.useMemo(() => {
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longest > MAX_WORK ? MAX_WORK / longest : 1;
    return {
      workW: Math.round(image.naturalWidth * scale),
      workH: Math.round(image.naturalHeight * scale),
    };
  }, [image.naturalWidth, image.naturalHeight]);

  // Measure the canvas's displayed box (relative to root) so overlays can be
  // positioned exactly over the rendered image.
  const measure = React.useCallback(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const cr = canvas.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    setBox({
      left: cr.left - rr.left,
      top: cr.top - rr.top,
      width: cr.width,
      height: cr.height,
    });
  }, []);

  React.useEffect(() => {
    measure();
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  React.useEffect(() => {
    measure();
  }, [workW, workH, measure]);

  // Composite render whenever inputs change.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sx = workW / image.naturalWidth;
    const sy = workH / image.naturalHeight;
    const regions = [
      ...faces.map((f) => ({
        region: {
          x: f.x * sx,
          y: f.y * sy,
          width: f.width * sx,
          height: f.height * sy,
        },
        blurred: f.blurred,
        isFace: true,
        shape: "ellipse" as RegionShape,
      })),
      ...textRegions.map((t) => ({
        region: {
          x: t.x * sx,
          y: t.y * sy,
          width: t.width * sx,
          height: t.height * sy,
        },
        blurred: t.blurred,
        isFace: false,
        shape: "rect" as RegionShape,
      })),
      ...manualRegions.map((m) => ({
        region: {
          x: m.x * sx,
          y: m.y * sy,
          width: m.width * sx,
          height: m.height * sy,
        },
        blurred: true,
        isFace: false,
        shape: m.shape,
      })),
    ];

    renderComposite(
      ctx,
      image.bitmap,
      image.naturalWidth,
      image.naturalHeight,
      workW,
      workH,
      regions,
      { blurType, intensity },
    );
  }, [
    image.bitmap,
    image.naturalWidth,
    image.naturalHeight,
    workW,
    workH,
    faces,
    textRegions,
    manualRegions,
    blurType,
    intensity,
  ]);

  const pointToNatural = React.useCallback(
    (clientX: number, clientY: number): Rect => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0, width: 0, height: 0 };
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * image.naturalWidth;
      const y = ((clientY - rect.top) / rect.height) * image.naturalHeight;
      return { x, y, width: 0, height: 0 };
    },
    [image.naturalWidth, image.naturalHeight],
  );

  const hitTest = React.useCallback(
    (pt: Rect) => {
      for (let i = manualRegions.length - 1; i >= 0; i--) {
        const r = manualRegions[i];
        const inside =
          r.shape === "ellipse"
            ? pointInEllipse(pt, r)
            : pt.x >= r.x &&
              pt.x <= r.x + r.width &&
              pt.y >= r.y &&
              pt.y <= r.y + r.height;
        if (inside) return { type: "manual" as const, id: r.id };
      }
      for (let i = textRegions.length - 1; i >= 0; i--) {
        if (!textRegions[i].blurred) continue;
        const r = textRegions[i];
        if (
          pt.x >= r.x &&
          pt.x <= r.x + r.width &&
          pt.y >= r.y &&
          pt.y <= r.y + r.height
        ) {
          return { type: "text" as const, id: r.id };
        }
      }
      for (let i = faces.length - 1; i >= 0; i--) {
        if (!faces[i].blurred) continue;
        const sq = faceToSquareRegion(faces[i]);
        if (pointInEllipse(pt, sq)) {
          return { type: "face" as const, id: faces[i].id };
        }
      }
      return null;
    },
    [manualRegions, textRegions, faces],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === "select") return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const p = pointToNatural(e.clientX, e.clientY);
    if (tool === "erase") {
      const hit = hitTest({ ...p });
      if (hit?.type === "manual") onRemoveManual(hit.id);
      else if (hit?.type === "face") onUnblurFace(hit.id);
      else if (hit?.type === "text") onUnblurText(hit.id);
      return;
    }
    dragRef.current = {
      startX: p.x,
      startY: p.y,
      pointerId: e.pointerId,
    };
    setDraft({ x: p.x, y: p.y, width: 0, height: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (tool !== "brush" || !dragRef.current) return;
    const p = pointToNatural(e.clientX, e.clientY);
    const start = dragRef.current;
    setDraft({
      x: Math.min(start.startX, p.x),
      y: Math.min(start.startY, p.y),
      width: Math.abs(p.x - start.startX),
      height: Math.abs(p.y - start.startY),
    });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (tool !== "brush" || !dragRef.current) return;
    const target = e.currentTarget as HTMLElement;
    try {
      target.releasePointerCapture(dragRef.current.pointerId);
    } catch {
      /* ignore */
    }
    const d = draft;
    dragRef.current = null;
    setDraft(null);
    if (d && d.width > 8 && d.height > 8) {
      onAddManual(d, brushShape);
    }
  };

  const cursor = tool === "brush" ? "crosshair" : tool === "erase" ? "cell" : "default";
  const badgesInteractive = tool === "select";

  return (
    <div
      ref={rootRef}
      className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden p-1"
    >
      <canvas
        ref={canvasRef}
        width={workW}
        height={workH}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="block max-h-full max-w-full rounded-lg"
        style={{ cursor, touchAction: "none" }}
      />

      {/* Overlay layer positioned exactly over the rendered canvas */}
      {box && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
          }}
        >
          {/* Face badges */}
          {faces.map((face, i) => (
            <FaceBadge
              key={face.id}
              face={face}
              index={i}
              naturalWidth={image.naturalWidth}
              naturalHeight={image.naturalHeight}
              onToggle={onToggleFace}
              className={cn(!badgesInteractive && "pointer-events-none")}
            />
          ))}

          {/* Text / plate badges */}
          {textRegions.map((t) => (
            <TextBadge
              key={t.id}
              region={t}
              naturalWidth={image.naturalWidth}
              naturalHeight={image.naturalHeight}
              onToggle={onToggleText}
              className={cn(!badgesInteractive && "pointer-events-none")}
            />
          ))}

          {/* Manual region outlines (erase mode hints) */}
          {tool === "erase" &&
            manualRegions.map((r) => (
              <div
                key={`outline-${r.id}`}
                className={cn(
                  "pointer-events-none absolute border-2 border-dashed border-rose-500",
                  r.shape === "ellipse" ? "rounded-full" : "rounded-sm",
                )}
                style={{
                  left: `${(r.x / image.naturalWidth) * 100}%`,
                  top: `${(r.y / image.naturalHeight) * 100}%`,
                  width: `${(r.width / image.naturalWidth) * 100}%`,
                  height: `${(r.height / image.naturalHeight) * 100}%`,
                }}
              />
            ))}

          {/* Draft rectangle/oval while drawing */}
          {draft && (
            <div
              className={cn(
                "pointer-events-none absolute border-2 border-emerald-500 bg-emerald-500/15",
                brushShape === "ellipse" ? "rounded-full" : "rounded-sm",
              )}
              style={{
                left: `${(draft.x / image.naturalWidth) * 100}%`,
                top: `${(draft.y / image.naturalHeight) * 100}%`,
                width: `${(draft.width / image.naturalWidth) * 100}%`,
                height: `${(draft.height / image.naturalHeight) * 100}%`,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Test whether a point lies inside an ellipse inscribed in `r`. */
function pointInEllipse(pt: Rect, r: Rect): boolean {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const rx = r.width / 2;
  const ry = r.height / 2;
  if (rx <= 0 || ry <= 0) return false;
  const dx = (pt.x - cx) / rx;
  const dy = (pt.y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}
