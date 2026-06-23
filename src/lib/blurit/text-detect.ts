// Text / license-plate / document detector.
// Engine priority: native TextDetector API (Chrome/Edge, instant + accurate)
// -> Tesseract.js v7 (all browsers, self-hosted, fallback)
//
// The native TextDetector (Experimental Shape Detection API) is the same
// class of API as FaceDetector — it runs natively in Chromium browsers and
// is instant + accurate. Tesseract is the fallback for Safari/Firefox.
//
// Privacy: ALL models load from the SAME ORIGIN (/tesseract/). No third-party
// fetch. The photo is processed entirely in the browser; nothing is uploaded.

import type { TextRegion, Rect } from "./types";

// ---- Native TextDetector (fast path) -----------------------------------

interface NativeDetectedText {
  boundingBox: DOMRectReadOnly;
  rawValue?: string;
}

function isTextDetectorAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { TextDetector?: unknown }).TextDetector ===
      "function"
  );
}

async function detectWithNative(
  canvas: HTMLCanvasElement,
  dw: number,
  dh: number,
  naturalWidth: number,
  naturalHeight: number,
): Promise<TextRegion[] | null> {
  if (!isTextDetectorAvailable()) return null;
  try {
    const TD = (
      window as unknown as {
        TextDetector: new () => {
          detect: (s: CanvasImageSource) => Promise<NativeDetectedText[]>;
          release?: () => void;
        };
      }
    ).TextDetector;
    const detector = new TD();
    const detected = await detector.detect(canvas);
    try {
      detector.release?.();
    } catch {
      /* ignore */
    }
    const upScaleX = naturalWidth / dw;
    const upScaleY = naturalHeight / dh;
    const regions: TextRegion[] = detected
      .filter((d) => {
        const label = (d.rawValue ?? "").trim();
        return label.length >= 2;
      })
      .map((d, i) => {
        const b = d.boundingBox;
        const r: Rect = {
          x: b.left * upScaleX,
          y: b.top * upScaleY,
          width: b.width * upScaleX,
          height: b.height * upScaleY,
        };
        return {
          id: `text-n-${i}-${Math.round(r.x)}-${Math.round(r.y)}`,
          kind: "text" as const,
          label: (d.rawValue ?? "text").trim().slice(0, 24),
          blurred: false,
          ...r,
        };
      });
    return regions;
  } catch {
    return null;
  }
}

// ---- Tesseract.js v7 (fallback) ----------------------------------------

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
    image: string | Blob,
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
        workerBlobURL: false,
        workerPath: `${origin}/tesseract/worker.min.js`,
        corePath: `${origin}/tesseract/tesseract-core-simd-lstm.js`,
        langPath: `${origin}/tesseract`,
        logger: () => {
          /* progress only */
        },
        errorHandler: (e: unknown) =>
          console.error("[BlurIt tesseract err]", e),
      })) as unknown as TesseractWorker;
      // PSM 11 = SPARSE_TEXT: find text anywhere in the image.
      await worker.setParameters({ tessedit_pageseg_mode: "11" });
      return worker;
    })();
  }
  return workerPromise;
}

function isLikelyRealText(text: string): boolean {
  const t = text.trim();
  // Require 2+ alphanumeric chars AND >50% alnum ratio. This filters out
  // wall/texture noise (which OCR reads as random symbols) while keeping
  // real text like "alamy", "ice", plate numbers, etc.
  if (t.length < 2) return false;
  const alnum = (t.match(/[a-zA-Z0-9]/g) ?? []).length;
  const nonSpace = t.replace(/\s/g, "").length;
  if (nonSpace === 0) return false;
  return alnum >= 2 && alnum / nonSpace > 0.5;
}

/**
 * Detect text regions. Tries native TextDetector first (instant in Chrome/
 * Edge), falls back to Tesseract.js for other browsers.
 */
export async function detectText(
  bitmap: ImageBitmap,
  naturalWidth: number,
  naturalHeight: number,
  onProgress?: (p: number) => void,
): Promise<TextRegion[]> {
  // Detection canvas — upscale to 1500px for better OCR on small text.
  // Bigger text = Tesseract recognizes it more reliably.
  const longest = Math.max(naturalWidth, naturalHeight);
  let scale = 1;
  if (longest < 1500) scale = 1500 / longest;
  if (longest > 2000) scale = 2000 / longest;
  const dw = Math.max(1, Math.round(naturalWidth * scale));
  const dh = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(bitmap, 0, 0, dw, dh);

  // 1. Native TextDetector (instant, Chrome/Edge).
  onProgress?.(0.2);
  const nativeResult = await detectWithNative(
    canvas,
    dw,
    dh,
    naturalWidth,
    naturalHeight,
  );
  if (nativeResult !== null) {
    onProgress?.(1);
    return nativeResult;
  }

  // 2. Tesseract.js fallback.
  onProgress?.(0.3);
  let worker: TesseractWorker | null = null;
  try {
    worker = await loadWorker();
  } catch {
    return [];
  }
  if (!worker) return [];

  onProgress?.(0.4);
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), "image/png"),
  );
  if (!blob) return [];
  const url = URL.createObjectURL(blob);
  let result: TesseractResult;
  try {
    // v7: MUST pass output { text: true, blocks: true } to get word boxes.
    result = await worker.recognize(url, {}, { text: true, blocks: true });
  } catch {
    URL.revokeObjectURL(url);
    return [];
  }
  URL.revokeObjectURL(url);
  onProgress?.(0.9);

  const data = result?.data;
  // v7 nests words under blocks[].paragraphs[].lines[].words.
  const nestedWords: TesseractWord[] = [];
  for (const block of data?.blocks ?? []) {
    const blockAny = block as unknown as {
      lines?: TesseractLine[];
      paragraphs?: TesseractParagraph[];
    };
    const lines = blockAny.lines ?? [];
    for (const paragraph of block?.paragraphs ?? blockAny.paragraphs ?? []) {
      for (const line of paragraph?.lines ?? []) {
        lines.push(line);
      }
    }
    for (const line of lines) {
      nestedWords.push(...(line.words ?? []));
    }
  }
  const allWords = (data?.words?.length ? data.words : nestedWords) ?? [];
  // Confidence 50 — filters out low-confidence wall/texture noise while
  // keeping real text. 25 was too low (caught walls), 70 too high (missed text).
  const words = allWords.filter(
    (w) => w.confidence >= 50 && isLikelyRealText(w.text),
  );

  if (words.length === 0) return [];

  const merged = mergeWords(words, dw, dh);
  const upScaleX = naturalWidth / dw;
  const upScaleY = naturalHeight / dh;

  const regions: TextRegion[] = merged.map((g, i) => {
    // Expand each region by 15% in each direction so the full text extent
    // is covered. OCR word boxes are often tight, missing character edges.
    const padX = g.w * 0.15;
    const padY = g.h * 0.25; // more vertical padding for tall letters
    const r: Rect = {
      x: (g.x - padX) * upScaleX,
      y: (g.y - padY) * upScaleY,
      width: (g.w + padX * 2) * upScaleX,
      height: (g.h + padY * 2) * upScaleY,
    };
    // Clamp to image bounds.
    const clampedX = Math.max(0, r.x);
    const clampedY = Math.max(0, r.y);
    const clampedW = Math.min(naturalWidth - clampedX, r.width);
    const clampedH = Math.min(naturalHeight - clampedY, r.height);
    return {
      id: `text-t-${i}-${Math.round(clampedX)}-${Math.round(clampedY)}`,
      kind: "text",
      label: g.label.slice(0, 24),
      blurred: false,
      x: clampedX,
      y: clampedY,
      width: clampedW,
      height: clampedH,
    };
  });

  onProgress?.(1);
  return regions;
}

// ---- Word merging (Tesseract fallback) ---------------------------------

interface MergedGroup {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

function mergeWords(
  words: TesseractWord[],
  dw: number,
  dh: number,
): MergedGroup[] {
  const groups: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    texts: string[];
  }[] = words.map((w) => ({
    x0: w.bbox.x0,
    y0: w.bbox.y0,
    x1: w.bbox.x1,
    y1: w.bbox.y1,
    texts: [w.text],
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

  const minArea = (dw * dh) * 0.00005;
  const maxArea = (dw * dh) * 0.7;
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
  const sameLine = Math.abs(aCy - bCy) < minH * 0.9;
  const gap = a.x1 <= b.x0 ? b.x0 - a.x1 : b.x1 <= a.x0 ? a.x0 - b.x1 : 0;
  // Wide gap tolerance (4x height) so separated words on the same line merge
  // into one covered region — prevents half-covered text.
  if (sameLine && gap < minH * 4) return true;
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
