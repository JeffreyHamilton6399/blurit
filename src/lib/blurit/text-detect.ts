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

  // Create canvas at original resolution (no preprocessing — Tesseract
  // handles color photos fine, preprocessing was hurting accuracy).
  const canvas = document.createElement("canvas");
  canvas.width = naturalWidth;
  canvas.height = naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) { onProgress?.(1); return []; }
  ctx.drawImage(bitmap, 0, 0, naturalWidth, naturalHeight);

  onProgress?.(0.3);

  // Run OCR.
  let result: TesseractResult;
  try {
    result = await worker.recognize(canvas, {}, { text: true, blocks: true });
    console.log("[BlurIt] OCR done. text:", JSON.stringify(result?.data?.text?.slice(0, 100)), "blocks:", result?.data?.blocks?.length);
  } catch (e) {
    console.error("[BlurIt] OCR recognize failed:", e);
    onProgress?.(1);
    return [];
  }

  onProgress?.(0.9);

  // Extract words from v7's nested structure.
  const data = result?.data;
  const words: TesseractWord[] = [];
  for (const block of data?.blocks ?? []) {
    const blockAny = block as unknown as { lines?: TesseractLine[]; paragraphs?: TesseractParagraph[] };
    const lines = blockAny.lines ?? [];
    for (const paragraph of block?.paragraphs ?? blockAny.paragraphs ?? []) {
      for (const line of paragraph?.lines ?? []) lines.push(line);
    }
    for (const line of lines) words.push(...(line.words ?? []));
  }
  // Also check flat words array (some versions populate it).
  const allWords = (data?.words?.length ? data.words : words) ?? [];

  console.log("[BlurIt] total words:", allWords.length, "sample:", allWords.slice(0, 5).map((w) => w.text));

  // Filter: keep words with reasonable confidence + real text.
  const filtered = allWords.filter((w) => {
    const t = w.text.trim();
    return w.confidence >= 30 && t.length >= 2 && /[a-zA-Z0-9]/.test(t);
  });

  console.log("[BlurIt] filtered words:", filtered.length);
  if (filtered.length === 0) { onProgress?.(1); return []; }

  // Merge adjacent words on the same line into text regions.
  const merged = mergeWords(filtered, naturalWidth, naturalHeight);
  console.log("[BlurIt] merged regions:", merged.length);

  onProgress?.(1);
  return merged.map((g, i) => {
    const padX = g.w * 0.1;
    const padY = g.h * 0.15;
    return {
      id: `text-${i}-${Math.round(g.x)}-${Math.round(g.y)}`,
      kind: "text" as const,
      label: g.label.slice(0, 24),
      blurred: false,
      x: Math.max(0, g.x - padX),
      y: Math.max(0, g.y - padY),
      width: Math.min(naturalWidth, g.w + padX * 2),
      height: Math.min(naturalHeight, g.h + padY * 2),
    };
  });
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
