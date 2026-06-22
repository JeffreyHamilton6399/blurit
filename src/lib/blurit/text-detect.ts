// Text / license-plate / document detector using Tesseract.js (OCR).
//
// Privacy: the Tesseract worker script, WASM core, and English traineddata
// are all SELF-HOSTED at /tesseract/ (same origin). No third-party fetch.
// The photo is processed entirely in the browser; nothing is uploaded.
//
// Strategy: run OCR on a downscaled grayscale canvas, collect word bounding
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
  // v7 nests lines under paragraphs (not directly on the block).
  paragraphs: TesseractParagraph[];
}

interface TesseractResult {
  data: {
    text?: string;
    // Top-level words is undefined when `blocks: true` is requested; words
    // live inside blocks[].paragraphs[].lines[].words instead.
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
        // wrapper so the worker loads directly and relative importScripts
        // inside it resolve against our origin.
        workerBlobURL: false,
        workerPath: `${origin}/tesseract/worker.min.js`,
        // Self-hosted SIMD+LSTM core (same origin).
        corePath: `${origin}/tesseract/tesseract-core-simd-lstm.js`,
        // Self-hosted English traineddata (same origin).
        langPath: `${origin}/tesseract`,
        logger: () => {
          /* progress only — no logging in production */
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

  // Downscale for OCR speed (max 1000px on the longest side).
  const MAX = 1000;
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

  onProgress?.(0.2);
  // Tesseract v7's loadImage accepts canvas elements, but in some worker
  // contexts the canvas can't be cloned across the worker boundary and the
  // recognize call silently returns 0 words. Serializing to a PNG blob URL is
  // the reliable path: the worker fetches a self-origin URL and decodes it.
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), "image/png"),
  );
  if (!blob) return [];
  const url = URL.createObjectURL(blob);
  let result: TesseractResult;
  try {
    result = await worker.recognize(url, {}, { text: true, blocks: true });
  } finally {
    URL.revokeObjectURL(url);
  }
  onProgress?.(0.9);

  const data = result?.data;
  // Tesseract v7 nests words under blocks[].paragraphs[].lines[].words when
  // `blocks: true` is requested. Fall back to the flat top-level `words`
  // array if the worker happened to populate it (e.g. a future API change).
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
    (w) => w.confidence >= 30 && w.text.trim().length >= 2,
  );

  if (words.length === 0) return [];

  // Group words into merged regions by spatial proximity. This turns a row of
  // plate characters / an address line into one tappable region.
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

  // Greedy union: merge any two boxes that overlap, or sit on the same line
  // and are horizontally close (gap < 1.5x median height).
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

  // Drop groups that are too small (noise) or too large (whole image).
  const minArea = (dw * dh) * 0.0004;
  const maxArea = (dw * dh) * 0.5;
  return groups
    .filter((g) => {
      const area = (g.x1 - g.x0) * (g.y1 - g.y0);
      return area >= minArea && area <= maxArea;
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
  // Overlap test (with a small tolerance).
  const tol = 4;
  const overlapX = !(a.x1 + tol < b.x0 || b.x1 + tol < a.x0);
  const overlapY = !(a.y1 + tol < b.y0 || b.y1 + tol < a.y0);
  if (overlapX && overlapY) return true;

  // Same-line neighbor test: vertical centers close, horizontal gap small.
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
  // Preserve reading order (left-to-right) for the label.
  const aFirst = a.x0 <= b.x0;
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
    texts: aFirst ? [...a.texts, ...b.texts] : [...b.texts, ...a.texts],
  };
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
