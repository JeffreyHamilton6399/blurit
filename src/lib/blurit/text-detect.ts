// Text / license-plate / document detector.
// Engine: native TextDetector (Chrome/Edge) → Tesseract.js v7 (npm package).
// Model weights self-hosted at /tesseract/. Photos never leave the browser.

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
    const TD = (window as unknown as {
      TextDetector: new () => {
        detect: (s: CanvasImageSource) => Promise<NativeDetectedText[]>;
        release?: () => void;
      };
    }).TextDetector;
    const detector = new TD();
    const detected = await detector.detect(canvas);
    try { detector.release?.(); } catch { /* ignore */ }
    const upScaleX = naturalWidth / dw;
    const upScaleY = naturalHeight / dh;
    const regions: TextRegion[] = detected
      .filter((d) => {
        const label = (d.rawValue ?? "").trim();
        return label.length >= 2;
      })
      .map((d, i) => {
        const b = d.boundingBox;
        const padX = b.width * 0.15;
        const padY = b.height * 0.25;
        const r: Rect = {
          x: Math.max(0, (b.left - padX) * upScaleX),
          y: Math.max(0, (b.top - padY) * upScaleY),
          width: Math.min(naturalWidth, (b.width + padX * 2) * upScaleX),
          height: Math.min(naturalHeight, (b.height + padY * 2) * upScaleY),
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

// ---- Tesseract.js v7 (npm package) -------------------------------------

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
  recognize: (image: string | Blob, opts?: Record<string, unknown>, output?: { text?: boolean; blocks?: boolean }) => Promise<TesseractResult>;
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
        logger: () => { /* progress only */ },
        errorHandler: (e: unknown) => console.error("[BlurIt tesseract err]", e),
      })) as unknown as TesseractWorker;
      await worker.setParameters({ tessedit_pageseg_mode: "11" });
      return worker;
    })();
  }
  return workerPromise;
}

function isLikelyRealText(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  const alnum = (t.match(/[a-zA-Z0-9]/g) ?? []).length;
  const nonSpace = t.replace(/\s/g, "").length;
  if (nonSpace === 0) return false;
  return alnum >= 2 && alnum / nonSpace > 0.5;
}

/**
 * Detect text regions. Tries native TextDetector → Tesseract.
 */
export async function detectText(
  bitmap: ImageBitmap,
  naturalWidth: number,
  naturalHeight: number,
  onProgress?: (p: number) => void,
): Promise<TextRegion[]> {
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
  const nativeResult = await detectWithNative(canvas, dw, dh, naturalWidth, naturalHeight);
  if (nativeResult !== null) {
    onProgress?.(1);
    return nativeResult;
  }

  // 2. Tesseract.js (reliable OCR).
  onProgress?.(0.3);
  try {
    const tessResult = await detectWithTesseract(canvas, dw, dh, naturalWidth, naturalHeight);
    onProgress?.(1);
    return tessResult;
  } catch { /* fall through */ }

  onProgress?.(1);
  return [];
}

async function detectWithTesseract(
  canvas: HTMLCanvasElement,
  dw: number, dh: number,
  naturalWidth: number, naturalHeight: number,
): Promise<TextRegion[]> {
  let worker: TesseractWorker | null = null;
  try { worker = await loadWorker(); } catch { return []; }
  if (!worker) return [];

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), "image/png"),
  );
  if (!blob) return [];
  const url = URL.createObjectURL(blob);
  let result: TesseractResult;
  try {
    result = await worker.recognize(url, {}, { text: true, blocks: true });
  } catch {
    URL.revokeObjectURL(url);
    return [];
  }
  URL.revokeObjectURL(url);

  const data = result?.data;
  const nestedWords: TesseractWord[] = [];
  for (const block of data?.blocks ?? []) {
    const blockAny = block as unknown as { lines?: TesseractLine[]; paragraphs?: TesseractParagraph[] };
    const lines = blockAny.lines ?? [];
    for (const paragraph of block?.paragraphs ?? blockAny.paragraphs ?? []) {
      for (const line of paragraph?.lines ?? []) lines.push(line);
    }
    for (const line of lines) nestedWords.push(...(line.words ?? []));
  }
  const allWords = (data?.words?.length ? data.words : nestedWords) ?? [];
  const words = allWords.filter((w) => w.confidence >= 50 && isLikelyRealText(w.text));
  if (words.length === 0) return [];

  const merged = mergeWords(words, dw, dh);
  const upScaleX = naturalWidth / dw;
  const upScaleY = naturalHeight / dh;

  return merged.map((g, i) => {
    const padX = g.w * 0.15;
    const padY = g.h * 0.25;
    return {
      id: `text-t-${i}-${Math.round(g.x)}-${Math.round(g.y)}`,
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

// ---- Word merging ------------------------------------------------------

interface MergedGroup { x: number; y: number; w: number; h: number; label: string }

function mergeWords(words: TesseractWord[], dw: number, dh: number): MergedGroup[] {
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
      x: g.x0, y: g.y0, w: g.x1 - g.x0, h: g.y1 - g.y0,
      label: g.texts.join(" ").replace(/\s+/g, " ").trim(),
    }));
}

function shouldMerge(a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }): boolean {
  const tol = 4;
  const overlapX = !(a.x1 + tol < b.x0 || b.x1 + tol < a.x0);
  const overlapY = !(a.y1 + tol < b.y0 || b.y1 + tol < a.y0);
  if (overlapX && overlapY) return true;
  const aCy = (a.y0 + a.y1) / 2, bCy = (b.y0 + b.y1) / 2;
  const aH = a.y1 - a.y0, bH = b.y1 - b.y0;
  const minH = Math.min(aH, bH);
  const sameLine = Math.abs(aCy - bCy) < minH * 0.9;
  const gap = a.x1 <= b.x0 ? b.x0 - a.x1 : b.x1 <= a.x0 ? a.x0 - b.x1 : 0;
  if (sameLine && gap < minH * 4) return true;
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
