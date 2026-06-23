// Text / license-plate / document detector.
// Uses Tesseract.js v7 — the best free client-side OCR.
// Self-hosted worker/core/lang. Photos never leave the browser.

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
  data: { text?: string; words?: TesseractWord[]; blocks?: TesseractBlock[] };
}
interface TesseractWorker {
  recognize: (image: CanvasImageSource | string | Blob, opts?: Record<string, unknown>, output?: { text?: boolean; blocks?: boolean }) => Promise<TesseractResult>;
  setParameters: (params: Record<string, string>) => Promise<void>;
  terminate: () => Promise<void>;
}

let workerPromise: Promise<TesseractWorker | null> | null = null;

async function loadWorker(): Promise<TesseractWorker | null> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const worker = (await createWorker(["eng"], 1, {
        workerBlobURL: false,
        workerPath: `${origin}/tesseract/worker.min.js`,
        corePath: `${origin}/tesseract/tesseract-core-simd-lstm.js`,
        langPath: `${origin}/tesseract`,
        logger: () => {},
        errorHandler: (e: unknown) => console.error("[BlurIt tesseract err]", e),
      })) as unknown as TesseractWorker;
      // PSM 3 = automatic page segmentation — the default, most reliable mode.
      await worker.setParameters({ tessedit_pageseg_mode: "3" });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Detect text regions via Tesseract OCR.
 */
export async function detectText(
  bitmap: ImageBitmap,
  naturalWidth: number,
  naturalHeight: number,
  onProgress?: (p: number) => void,
): Promise<TextRegion[]> {
  onProgress?.(0.1);

  // Load worker.
  let worker: TesseractWorker | null = null;
  try {
    worker = await loadWorker();
  } catch (e) {
    console.error("[BlurIt] Tesseract worker load failed:", e);
    onProgress?.(1);
    return [];
  }
  if (!worker) { onProgress?.(1); return []; }

  // Upscale to 2000px longest side — bigger text = much better recognition.
  // Tesseract's LSTM needs text to be at least ~20px tall; small photo text
  // is often 10-15px, so 2x upscale makes it readable.
  const longest = Math.max(naturalWidth, naturalHeight);
  const targetLongest = 2000;
  const scale = longest < targetLongest ? targetLongest / longest : 1;
  const dw = Math.round(naturalWidth * scale);
  const dh = Math.round(naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) { onProgress?.(1); return []; }
  // High-quality smoothing for upscaling.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, dw, dh);

  // Grayscale + normalize contrast — OCR works best on high-contrast B/W-ish.
  grayscaleAndNormalize(ctx, dw, dh);

  onProgress?.(0.3);

  // Run OCR with PSM 3 (auto) first, then PSM 11 (sparse) if nothing found.
  // PSM 3 is good for structured text; PSM 11 catches scattered text.
  let allWords: TesseractWord[] = [];

  for (const psm of ["3", "11"]) {
    try {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
      const words = extractWords(result?.data);
      console.log(`[BlurIt] PSM ${psm}: ${words.length} words, text:`, JSON.stringify(result?.data?.text?.slice(0, 80)));
      allWords.push(...words);
    } catch (e) {
      console.error(`[BlurIt] PSM ${psm} failed:`, e);
    }
    // If PSM 3 found words, skip PSM 11.
    if (allWords.length > 0) break;
  }

  // Dedupe words by position.
  const seen = new Set<string>();
  const deduped = allWords.filter((w) => {
    const key = `${Math.round(w.bbox.x0 / 5)}-${Math.round(w.bbox.y0 / 5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Filter: very low threshold (20) to catch faint text.
  const filtered = deduped.filter((w) => {
    const t = w.text.trim();
    return w.confidence >= 20 && t.length >= 1 && /[a-zA-Z0-9]/.test(t);
  });

  console.log("[BlurIt] total:", allWords.length, "deduped:", deduped.length, "filtered:", filtered.length);
  if (filtered.length === 0) { onProgress?.(1); return []; }

  // Merge adjacent words into text regions.
  const merged = mergeWords(filtered, dw, dh);
  console.log("[BlurIt] merged regions:", merged.length);

  // Scale back to natural coordinates.
  const upScaleX = naturalWidth / dw;
  const upScaleY = naturalHeight / dh;

  onProgress?.(1);
  return merged.map((g, i) => {
    const padX = g.w * 0.1;
    const padY = g.h * 0.15;
    return {
      id: `text-${i}-${Math.round(g.x)}-${Math.round(g.y)}`,
      kind: "text" as const,
      label: g.label.slice(0, 24),
      blurred: false,
      x: Math.max(0, (g.x - padX) * upScaleX),
      y: Math.max(0, (g.y - padY) * upScaleY),
      width: Math.min(naturalWidth, (g.w + padX * 2) * upScaleX),
      height: Math.min(naturalHeight, (g.h + padY * 2) * upScaleY),
    };
  });
}

/** Extract words from Tesseract v7's nested structure. */
function extractWords(data: TesseractResult["data"]): TesseractWord[] {
  const words: TesseractWord[] = [];
  for (const block of data?.blocks ?? []) {
    const blockAny = block as unknown as { lines?: TesseractLine[]; paragraphs?: TesseractParagraph[] };
    const lines = blockAny.lines ?? [];
    for (const paragraph of block?.paragraphs ?? blockAny.paragraphs ?? []) {
      for (const line of paragraph?.lines ?? []) lines.push(line);
    }
    for (const line of lines) words.push(...(line.words ?? []));
  }
  return (data?.words?.length ? data.words : words) ?? [];
}

/**
 * Convert to grayscale and normalize contrast using histogram stretching.
 * This is THE key preprocessing step for OCR on photos — Tesseract expects
 * high-contrast black-on-white text, not color photos.
 */
function grayscaleAndNormalize(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  // Grayscale (luminance) + find min/max for contrast stretch.
  let min = 255, max = 0;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    gray[j] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }

  // Stretch contrast to full 0-255 range.
  const range = max - min || 1;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = ((gray[j] - min) * 255) / range;
    d[i] = d[i + 1] = d[i + 2] = v;
  }

  ctx.putImageData(imageData, 0, 0);
}

// ---- Word merging ------------------------------------------------------

interface MergedGroup { x: number; y: number; w: number; h: number; label: string }

function mergeWords(words: TesseractWord[], nw: number, nh: number): MergedGroup[] {
  const groups: { x0: number; y0: number; x1: number; y1: number; texts: string[] }[] =
    words.map((w) => ({ x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1, texts: [w.text] }));

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

  return groups
    .filter((g) => {
      const area = (g.x1 - g.x0) * (g.y1 - g.y0);
      return area > 20 && area < nw * nh * 0.5;
    })
    .map((g) => ({
      x: g.x0, y: g.y0, w: g.x1 - g.x0, h: g.y1 - g.y0,
      label: g.texts.join(" ").replace(/\s+/g, " ").trim(),
    }));
}

function shouldMerge(a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }): boolean {
  const tol = 4;
  // Overlapping boxes merge.
  const overlapX = !(a.x1 + tol < b.x0 || b.x1 + tol < a.x0);
  const overlapY = !(a.y1 + tol < b.y0 || b.y1 + tol < a.y0);
  if (overlapX && overlapY) return true;
  // Same-line neighbors merge if close horizontally.
  const aCy = (a.y0 + a.y1) / 2;
  const bCy = (b.y0 + b.y1) / 2;
  const minH = Math.min(a.y1 - a.y0, b.y1 - b.y0);
  if (Math.abs(aCy - bCy) < minH * 0.7) {
    const gap = a.x1 <= b.x0 ? b.x0 - a.x1 : b.x1 <= a.x0 ? a.x0 - b.x1 : 0;
    if (gap < minH * 3) return true;
  }
  return false;
}

function mergeBox(a: { x0: number; y0: number; x1: number; y1: number; texts: string[] }, b: { x0: number; y0: number; x1: number; y1: number; texts: string[] }) {
  const aFirst = a.x0 <= b.x0;
  return {
    x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
    texts: aFirst ? [...a.texts, ...b.texts] : [...b.texts, ...a.texts],
  };
}

export async function terminateTextWorker(): Promise<void> {
  if (workerPromise) {
    try { const w = await workerPromise; await w?.terminate(); } catch { /* ignore */ }
    workerPromise = null;
  }
}
