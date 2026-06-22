// Canvas blur rendering utilities. All regions are in the same coordinate
// space as the destination canvas (caller scales natural -> canvas coords).

import type { BlurIntensity, BlurType, RegionShape, Rect } from "./types";

export interface RenderOptions {
  blurType: BlurType;
  intensity: BlurIntensity;
}

export interface RenderRegion {
  region: Rect;
  blurred: boolean;
  isFace: boolean;
  shape: RegionShape;
}

/** Block size (in destination px) for pixelation per intensity. */
function pixelBlock(intensity: BlurIntensity): number {
  switch (intensity) {
    case "light":
      return 6;
    case "medium":
      return 11;
    case "heavy":
      return 18;
  }
}

/** Blur radius (in destination px) for gaussian per intensity. */
function gaussianRadius(intensity: BlurIntensity): number {
  switch (intensity) {
    case "light":
      return 6;
    case "medium":
      return 12;
    case "heavy":
      return 22;
  }
}

/**
 * Draw the pristine source image scaled to fit the destination canvas.
 */
export function drawBase(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
}

/** Clip to a region's shape (rect or ellipse). */
function clipShape(
  ctx: CanvasRenderingContext2D,
  region: Rect,
  shape: RegionShape,
) {
  ctx.beginPath();
  if (shape === "ellipse") {
    ctx.ellipse(
      region.x + region.width / 2,
      region.y + region.height / 2,
      region.width / 2,
      region.height / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else {
    ctx.rect(region.x, region.y, region.width, region.height);
  }
  ctx.clip();
}

/**
 * Apply a blur effect to a single region by sampling from the pristine
 * source (so effects are idempotent and never compound).
 */
export function blurRegion(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  destW: number,
  destH: number,
  region: Rect,
  shape: RegionShape,
  opts: RenderOptions,
) {
  const sx = (region.x / destW) * sourceW;
  const sy = (region.y / destH) * sourceH;
  const sw = (region.width / destW) * sourceW;
  const sh = (region.height / destH) * sourceH;

  const cx = Math.max(0, Math.min(sx, sourceW));
  const cy = Math.max(0, Math.min(sy, sourceH));
  const cw = Math.max(1, Math.min(sw, sourceW - cx));
  const ch = Math.max(1, Math.min(sh, sourceH - cy));

  if (cw <= 0 || ch <= 0) return;

  const dx = region.x;
  const dy = region.y;
  const dw = region.width;
  const dh = region.height;

  if (opts.blurType === "black") {
    ctx.save();
    clipShape(ctx, region, shape);
    ctx.fillStyle = "#000000";
    ctx.fillRect(dx, dy, dw, dh);
    ctx.restore();
    return;
  }

  if (opts.blurType === "gaussian") {
    const radius = gaussianRadius(opts.intensity);
    ctx.save();
    clipShape(ctx, region, shape);
    ctx.filter = `blur(${radius}px)`;
    const overscan = radius * 2;
    ctx.drawImage(
      source,
      cx - overscan,
      cy - overscan,
      cw + overscan * 2,
      ch + overscan * 2,
      dx - overscan,
      dy - overscan,
      dw + overscan * 2,
      dh + overscan * 2,
    );
    ctx.filter = "none";
    ctx.restore();
    return;
  }

  // pixelate (default)
  const block = pixelBlock(opts.intensity);
  const tw = Math.max(1, Math.round(dw / block));
  const th = Math.max(1, Math.round(dh / block));
  const tmp = document.createElement("canvas");
  tmp.width = tw;
  tmp.height = th;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  tctx.imageSmoothingEnabled = true;
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(source, cx, cy, cw, ch, 0, 0, tw, th);
  ctx.save();
  clipShape(ctx, region, shape);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, tw, th, dx, dy, dw, dh);
  ctx.restore();
}

/** Convert a face bounding box to a square region (circle circumscribing the face). */
export function faceToSquareRegion(face: Rect, padding = 0.12): Rect {
  const size = Math.max(face.width, face.height) * (1 + padding);
  const cx = face.x + face.width / 2;
  const cy = face.y + face.height / 2;
  return {
    x: cx - size / 2,
    y: cy - size / 2,
    width: size,
    height: size,
  };
}

/**
 * Render the full composite: base image + all blurred regions.
 */
export function renderComposite(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  destW: number,
  destH: number,
  regions: RenderRegion[],
  opts: RenderOptions,
) {
  drawBase(ctx, source, destW, destH);
  for (const r of regions) {
    if (!r.blurred) continue;
    const region = r.isFace ? faceToSquareRegion(r.region) : r.region;
    const shape: RegionShape = r.isFace ? "ellipse" : r.shape;
    blurRegion(ctx, source, sourceW, sourceH, destW, destH, region, shape, opts);
  }
}
