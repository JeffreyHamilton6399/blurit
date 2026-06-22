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
  Tool,
} from "@/lib/blurit/types";
import { FaceBadge } from "./face-badge";

interface PhotoCanvasProps {
  image: LoadedImage;
  faces: FaceRegion[];
  manualRegions: ManualRegion[];
  blurType: BlurType;
  intensity: BlurIntensity;
  tool: Tool;
  onToggleFace: (id: string) => void;
  onAddManual: (region: Rect) => void;
  onRemoveManual: (id: string) => void;
  onUnblurFace: (id: string) => void;
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
  manualRegions,
  blurType,
  intensity,
  tool,
  onToggleFace,
  onAddManual,
  onRemoveManual,
  onUnblurFace,
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
  // positioned exactly over the rendered image. The canvas is a replaced
  // element sized by max-w/max-h against the definite-height root, so it may
  // be letterboxed inside the root.
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

  // Re-measure when the working size changes (new image).
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
        if (
          pt.x >= r.x &&
          pt.x <= r.x + r.width &&
          pt.y >= r.y &&
          pt.y <= r.y + r.height
        ) {
          return { type: "manual" as const, id: r.id };
        }
      }
      for (let i = faces.length - 1; i >= 0; i--) {
        if (!faces[i].blurred) continue;
        const sq = faceToSquareRegion(faces[i]);
        const cx = sq.x + sq.width / 2;
        const cy = sq.y + sq.height / 2;
        const radius = sq.width / 2;
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          return { type: "face" as const, id: faces[i].id };
        }
      }
      return null;
    },
    [manualRegions, faces],
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
      onAddManual(d);
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

          {/* Manual region outlines (erase mode hints) */}
          {tool === "erase" &&
            manualRegions.map((r) => (
              <div
                key={`outline-${r.id}`}
                className="pointer-events-none absolute rounded-sm border-2 border-dashed border-rose-500"
                style={{
                  left: `${(r.x / image.naturalWidth) * 100}%`,
                  top: `${(r.y / image.naturalHeight) * 100}%`,
                  width: `${(r.width / image.naturalWidth) * 100}%`,
                  height: `${(r.height / image.naturalHeight) * 100}%`,
                }}
              />
            ))}

          {/* Draft rectangle while drawing */}
          {draft && (
            <div
              className="pointer-events-none absolute rounded-sm border-2 border-emerald-500 bg-emerald-500/15"
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
