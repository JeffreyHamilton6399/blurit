// Text / license-plate / document detector using Tesseract.js (OCR).
//
// Privacy: the Tesseract worker script, WASM core, and English traineddata
// are all SELF-HOSTED at /tesseract/ (same origin). No third-party fetch.
// The photo is processed entirely in the browser; nothing is uploaded.
//
// Strategy: run OCR on a downscaled preprocessed canvas, collect word bounding
// boxes, then merge adjacent words into line-ish regions. License plates and
// addresses show up as clusters of recognized text. The user toggles which
// detectors run in Settings; only enabled ones execute.

import type { TextRegion, Rect } from "./types";

interface TesseractWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

interface TesseractLine {
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words: TesseractWord[];
}

interface TesseractParagraph {
  bbox: { x0: number; y0: number; x1: number; y1: number };
  lines: TesseractLine[];
}

interface TesseractBlock {
  bbox: { x0: number; y0: number; x1: number; y1: number };
  paragraphs: TesseractParagraph[];
}

interface TesseractResult {
  data: {
    text?: string;
    words?: TesseractWord[];
    blocks?: TesseractBlock[];
  };
}

interface TesseractWorker {
  recognize: (
    image: string,
    opts?: Record<string, unknown>,
    output?: { text?: boolean; blocks?: boolean },
  ) => Promise<TesseractResult>;
  setParameters: (params: Record<string, string>) => Promise<void>;
  terminate: () => Promise<void>;
}

let workerPromise: Promise<TesseractWorker | null> | null = null;

async function loadWorker(): Promise<TesseractWorker | null> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const worker = (await createWorker(["eng"], 1, {
        // Self-hosted worker script (same origin). Disable the blob-URL
        // wrapper so the worker loads directly.
        workerBlobURL: false,
        workerPath: `${origin}/tesseract/worker.min.js`,
        // Self-hosted SIMD+LSTM core (same origin).
        corePath: `${origin}/tesseract/tesseract-core-simd-lstm.js`,
        // Self-hosted English traineddata (same origin).
        langPath: `${origin}/tesseract`,
        logger: () => {
          /* progress only */
        },
        errorHandler: (e: unknown) =>
          console.error("[BlurIt tesseract err]", e),
      })) as unknown as TesseractWorker;
      // PSM 11 = SPARSE_TEXT: find text anywhere in the image without assuming
      // a column layout. Best for photos with plates, addresses, signs.
      await worker.setParameters({ tessedit_pageseg_mode: "11" });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Detect text regions (license plates, addresses, documents) via OCR.
 * Returns merged bounding boxes labeled with a short snippet of recognized
 * text. Runs on a downscaled canvas for speed; boxes scaled back to natural
 * image coordinates.
 */
export async function detectText(
  bitmap: ImageBitmap,
  naturalWidth: number,
  naturalHeight: number,
  onProgress?: (p: number) => void,
): Promise<TextRegion[]> {
  const worker = await loadWorker();
  if (!worker) return [];

  // Downscale for OCR speed (max 1200px on the longest side — larger canvas
  // improves small-text recall on plates/signs).
  const MAX = 1200;
  const scale =
    Math.max(naturalWidth, naturalHeight) > MAX
      ? MAX / Math.max(naturalWidth, naturalHeight)
      : 1;
  const dw = Math.max(1, Math.round(naturalWidth * scale));
  const dh = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(bitmap, 0, 0, dw, dh);

  // Preprocessing disabled — testing whether it breaks OCR.
  // preprocessForOcr(ctx, dw, dh);

  onProgress?.(0.2);
  // Serialize to a PNG blob URL — the reliable path for Tesseract's worker.
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), "image/png"),
  );
  if (!blob) return [];
  const url = URL.createObjectURL(blob);

  // DEBUG: Try createWorker with oem=3 (DEFAULT: legacy+LSTM) and CDN.
  const { createWorker } = await import("tesseract.js");
  console.log("[BlurIt OCR] creating worker oem=3 (DEFAULT)...");
  const debugWorker = await createWorker("eng", 3, {
    logger: (m: unknown) => console.log("[BlurIt OCR progress]", m),
  });
  const debugResult = await debugWorker.recognize(url);
  await debugWorker.terminate();
  console.log("[BlurIt OCR] oem=3 text:", JSON.stringify(debugResult?.data?.text?.slice(0, 80)));
  URL.revokeObjectURL(url);
  onProgress?.(0.9);

  const data = debugResult?.data;
  // Tesseract v7 nests words under blocks[].paragraphs[].lines[].words when
  // `blocks: true` is requested. Fall back to flat top-level `words`.
  const nestedWords: TesseractWord[] = [];
  for (const block of data?.blocks ?? []) {
    for (const paragraph of block?.paragraphs ?? []) {
      for (const line of paragraph?.lines ?? []) {
        nestedWords.push(...(line.words ?? []));
      }
    }
  }
  const allWords = (data?.words?.length ? data.words : nestedWords) ?? [];
  const words = allWords.filter(
    (w) => w.confidence >= 40 && isLikelyRealText(w.text),
  );

  if (words.length === 0) return [];

  // Group words into merged regions by spatial proximity.
  const merged = mergeWords(words, dw, dh);

  const upScaleX = naturalWidth / dw;
  const upScaleY = naturalHeight / dh;

  const regions: TextRegion[] = merged.map((g, i) => {
    const r: Rect = {
      x: g.x * upScaleX,
      y: g.y * upScaleY,
      width: g.w * upScaleX,
      height: g.h * upScaleY,
    };
    return {
      id: `text-${i}-${Math.round(r.x)}-${Math.round(r.y)}`,
      kind: "text",
      label: g.label.slice(0, 24),
      blurred: false,
      ...r,
    };
  });

  onProgress?.(1);
  return regions;
}

interface MergedGroup {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

/** Merge words whose bounding boxes overlap or are close (row neighbors). */
function mergeWords(
  words: TesseractWord[],
  dw: number,
  dh: number,
): MergedGroup[] {
  const boxes = words.map((w) => ({
    x0: w.bbox.x0,
    y0: w.bbox.y0,
    x1: w.bbox.x1,
    y1: w.bbox.y1,
    text: w.text,
  }));

  const groups: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    texts: string[];
  }[] = boxes.map((b) => ({
    x0: b.x0,
    y0: b.y0,
    x1: b.x1,
    y1: b.y1,
    texts: [b.text],
  }));

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (shouldMerge(groups[i], groups[j])) {
          groups[i] = mergeBox(groups[i], groups[j]);
          groups.splice(j, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  const minArea = (dw * dh) * 0.0004;
  const maxArea = (dw * dh) * 0.5;
  return groups
    .filter((g) => {
      const area = (g.x1 - g.x0) * (g.y1 - g.y0);
      if (area < minArea || area > maxArea) return false;
      const label = g.texts.join(" ").replace(/\s+/g, " ").trim();
      return isLikelyRealText(label);
    })
    .map((g) => ({
      x: g.x0,
      y: g.y0,
      w: g.x1 - g.x0,
      h: g.y1 - g.y0,
      label: g.texts.join(" ").replace(/\s+/g, " ").trim(),
    }));
}

function shouldMerge(
  a: { x0: number; y0: number; x1: number; y1: number },
  b: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  const tol = 4;
  const overlapX = !(a.x1 + tol < b.x0 || b.x1 + tol < a.x0);
  const overlapY = !(a.y1 + tol < b.y0 || b.y1 + tol < a.y0);
  if (overlapX && overlapY) return true;

  const aCy = (a.y0 + a.y1) / 2;
  const bCy = (b.y0 + b.y1) / 2;
  const aH = a.y1 - a.y0;
  const bH = b.y1 - b.y0;
  const minH = Math.min(aH, bH);
  const sameLine = Math.abs(aCy - bCy) < minH * 0.6;
  const gap =
    a.x1 <= b.x0 ? b.x0 - a.x1 : b.x1 <= a.x0 ? a.x0 - b.x1 : 0;
  if (sameLine && gap < minH * 2.2) return true;

  return false;
}

function mergeBox(
  a: { x0: number; y0: number; x1: number; y1: number; texts: string[] },
  b: { x0: number; y0: number; x1: number; y1: number; texts: string[] },
) {
  const aFirst = a.x0 <= b.x0;
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
    texts: aFirst ? [...a.texts, ...b.texts] : [...b.texts, ...a.texts],
  };
}

/**
 * Preprocess a canvas for OCR: convert to grayscale and stretch contrast to
 * the full 0–255 range. Normalizes photos into high-contrast black-on-white.
 */
function preprocessForOcr(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  let min = 255;
  let max = 0;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) | 0;
    gray[j] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }

  const range = max - min || 1;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = ((gray[j] - min) * 255) / range;
    d[i] = d[i + 1] = d[i + 2] = v;
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Heuristic: does this text look like real alphanumeric content (not symbol
 * noise)? Requires at least 2 alphanumeric chars and > 40% alnum ratio.
 */
function isLikelyRealText(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  const alnum = (t.match(/[a-zA-Z0-9]/g) ?? []).length;
  const nonSpace = t.replace(/\s/g, "").length;
  if (nonSpace === 0) return false;
  return alnum >= 2 && alnum / nonSpace > 0.4;
}

/** Release the OCR worker (called on unmount / reset). */
export async function terminateTextWorker(): Promise<void> {
  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w?.terminate();
    } catch {
      /* ignore */
    }
    workerPromise = null;
  }
}
