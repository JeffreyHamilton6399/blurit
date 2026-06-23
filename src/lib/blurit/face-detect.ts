// Face detection — best free: SSD MobileNet V1 via @vladmandic/face-api.
// Engine: native FaceDetector (Chrome/Edge) → SSD MobileNet → manual.
// Tuned for MAXIMUM RECALL — catches small/background faces via multi-scale
// detection (full image + 4 quadrants + lower confidence threshold).
// Model weights self-hosted at /models/face-api/. Photos never leave browser.

import type { DetectionResult, FaceRegion, Rect } from "./types";

function isFaceDetectorAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { FaceDetector?: unknown }).FaceDetector ===
      "function"
  );
}

interface NativeDetectedFace {
  boundingBox: DOMRectReadOnly;
}

export async function detectFaces(
  bitmap: ImageBitmap,
  naturalWidth: number,
  naturalHeight: number,
): Promise<DetectionResult> {
  const longest = Math.max(naturalWidth, naturalHeight);
  let scale = 1;
  // Upscale small images so faces are big enough for the model.
  if (longest < 1000) scale = 1000 / longest;
  // Don't downscale below 2000 — keep detail for small background faces.
  if (longest > 2400) scale = 2400 / longest;
  const dw = Math.max(1, Math.round(naturalWidth * scale));
  const dh = Math.max(1, Math.round(naturalHeight * scale));

  const detectCanvas = document.createElement("canvas");
  detectCanvas.width = dw;
  detectCanvas.height = dh;
  const dctx = detectCanvas.getContext("2d", { willReadFrequently: true });
  if (!dctx) return manualResult("Canvas unavailable — draw blur boxes manually.");
  dctx.drawImage(bitmap, 0, 0, dw, dh);

  // 1. Native FaceDetector (Chrome/Edge, instant). Still run SSD after to
  //    catch any faces native missed (native is conservative on small faces).
  let nativeFaces: FaceRegion[] = [];
  if (isFaceDetectorAvailable()) {
    try {
      const FD = (window as unknown as {
        FaceDetector: new (opts?: { maxDetectedFaces?: number; fastMode?: boolean }) => {
          detect: (s: CanvasImageSource) => Promise<NativeDetectedFace[]>;
          release?: () => void;
        };
      }).FaceDetector;
      const detector = new FD({ fastMode: false, maxDetectedFaces: 100 });
      const detected = await detector.detect(detectCanvas);
      try { detector.release?.(); } catch { /* ignore */ }
      nativeFaces = toFaces(detected, dw, dh, naturalWidth, naturalHeight);
    } catch { /* fall through */ }
  }

  // 2. SSD MobileNet V1 — full image pass.
  let ssdFaces: FaceRegion[] = [];
  try {
    ssdFaces = await detectWithSsdMobilenet(detectCanvas, dw, dh, naturalWidth, naturalHeight);
  } catch { /* fall through */ }

  // 3. Multi-scale: run SSD on 4 overlapping quadrants (2x zoom) to catch
  //    small/background faces the full-image pass missed.
  let quadFaces: FaceRegion[] = [];
  if (dw >= 500 && dh >= 500) {
    try {
      quadFaces = await detectQuadrants(detectCanvas, dw, dh, naturalWidth, naturalHeight);
    } catch { /* ignore */ }
  }

  // Merge all detections + NMS to remove duplicates.
  const allFaces = nms([...nativeFaces, ...ssdFaces, ...quadFaces], 0.3);

  if (allFaces.length > 0) {
    return buildResult(allFaces, true, nativeFaces.length > 0 ? "native" : "blazeface");
  }

  return manualResult("No faces found — draw boxes manually");
}

function buildResult(faces: FaceRegion[], available: boolean, engine: DetectionResult["engine"]): DetectionResult {
  const note = faces.length > 0 ? `${faces.length} face${faces.length > 1 ? "s" : ""} found` : "No faces found — draw boxes manually";
  return { faces, textRegions: [], available, engine, note };
}

function manualResult(note: string): DetectionResult {
  return { faces: [], textRegions: [], available: false, engine: "none", note };
}

function toFaces(detected: NativeDetectedFace[], dw: number, dh: number, nw: number, nh: number): FaceRegion[] {
  const sx = nw / dw, sy = nh / dh;
  return detected.map((f, i) => {
    const b = f.boundingBox;
    const r: Rect = { x: b.left * sx, y: b.top * sy, width: b.width * sx, height: b.height * sy };
    return { id: `face-n-${i}-${Math.round(r.x)}-${Math.round(r.y)}`, kind: "face", blurred: false, ...r };
  });
}

/** NMS — remove overlapping duplicates. Lower threshold = keep more distinct faces. */
function nms(faces: FaceRegion[], iouThreshold = 0.3): FaceRegion[] {
  const kept: FaceRegion[] = [];
  const suppressed = new Set<string>();
  for (let i = 0; i < faces.length; i++) {
    if (suppressed.has(faces[i].id)) continue;
    kept.push(faces[i]);
    for (let j = i + 1; j < faces.length; j++) {
      if (suppressed.has(faces[j].id)) continue;
      if (iou(faces[i], faces[j]) > iouThreshold) suppressed.add(faces[j].id);
    }
  }
  return kept;
}

function iou(a: Rect, b: Rect): number {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width), y1 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

// ---- SSD MobileNet V1 (npm package) ------------------------------------

interface FaceApiDetection { box: { x: number; y: number; width: number; height: number }; score: number }

let modelPromise: Promise<boolean | null> | null = null;

async function loadModel(): Promise<boolean | null> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      await faceapi.nets.ssdMobilenetv1.loadFromUri("/models/face-api");
      return true;
    })();
  }
  return modelPromise;
}

async function detectWithSsdMobilenet(
  canvas: HTMLCanvasElement,
  dw: number, dh: number, nw: number, nh: number,
  offsetX = 0, offsetY = 0, srcW?: number, srcH?: number,
): Promise<FaceRegion[]> {
  const ready = await loadModel();
  if (!ready) return [];
  const faceapi = await import("@vladmandic/face-api");
  // Very low minConfidence (0.1) to catch every possible face — false
  // positives are fine, the user can erase them. Better safe than miss.
  const detections = await faceapi.detectAllFaces(
    canvas,
    new faceapi.SsdMobilenetv1Options({ minConfidence: 0.1, maxResults: 200 }),
  );
  const refW = srcW ?? dw, refH = srcH ?? dh;
  const sx = nw / refW, sy = nh / refH;
  return detections.map((d, i) => {
    const b = d.box;
    const r: Rect = {
      x: (b.x + offsetX) * sx,
      y: (b.y + offsetY) * sy,
      width: b.width * sx,
      height: b.height * sy,
    };
    return {
      id: `face-s-${offsetX}-${offsetY}-${i}-${Math.round(r.x)}-${Math.round(r.y)}`,
      kind: "face" as const, blurred: false, ...r,
    };
  });
}

/** Run detection on 4 overlapping quadrants for multi-scale small-face recall. */
async function detectQuadrants(
  fullCanvas: HTMLCanvasElement,
  dw: number, dh: number, nw: number, nh: number,
): Promise<FaceRegion[]> {
  const hw = Math.floor(dw / 2);
  const hh = Math.floor(dh / 2);
  const overlap = 0.2; // 20% overlap so faces on quadrant borders aren't missed
  const ox = Math.floor(hw * overlap);
  const oy = Math.floor(hh * overlap);
  const quads = [
    { x: 0, y: 0, w: hw + ox, h: hh + oy },
    { x: hw - ox, y: 0, w: hw + ox, h: hh + oy },
    { x: 0, y: hh - oy, w: hw + ox, h: hh + oy },
    { x: hw - ox, y: hh - oy, w: hw + ox, h: hh + oy },
  ];
  const results = await Promise.all(
    quads.map(async (q) => {
      const qc = document.createElement("canvas");
      qc.width = q.w;
      qc.height = q.h;
      const qctx = qc.getContext("2d", { willReadFrequently: true });
      if (!qctx) return [];
      qctx.drawImage(fullCanvas, q.x, q.y, q.w, q.h, 0, 0, q.w, q.h);
      return detectWithSsdMobilenet(qc, q.w, q.h, nw, nh, q.x, q.y, dw, dh);
    }),
  );
  return results.flat();
}
