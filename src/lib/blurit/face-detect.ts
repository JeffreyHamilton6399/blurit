// Face detection.
// Engine priority: native FaceDetector API (Chrome/Edge, instant, zero deps)
// -> self-hosted BlazeFace via TensorFlow.js (all browsers, ~0.4MB model
//    served same-origin from /public/models so no third-party fetch)
// -> manual only (draw blur boxes by hand).
//
// Privacy: the BlazeFace model weights load from the SAME ORIGIN (/models/).
// Your photo is NEVER sent anywhere — detection runs locally in the browser.

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

/**
 * Detect faces in an image. Detection runs on a downscaled canvas for speed,
 * then boxes are scaled back up to natural image coordinates. Overlapping
 * duplicates are removed via non-maximum suppression.
 */
export async function detectFaces(
  bitmap: ImageBitmap,
  naturalWidth: number,
  naturalHeight: number,
): Promise<DetectionResult> {
  // Upscale small images to 1000px so small faces are detectable by BlazeFace
  // (which downsamples to 128px). For large images, downscale to 1600px.
  const longest = Math.max(naturalWidth, naturalHeight);
  let MAX: number;
  let scale: number;
  if (longest < 1000) {
    // Upscale small images.
    MAX = 1000;
    scale = MAX / longest;
  } else if (longest > 1600) {
    // Downscale large images.
    MAX = 1600;
    scale = MAX / longest;
  } else {
    scale = 1;
  }
  const dw = Math.max(1, Math.round(naturalWidth * scale));
  const dh = Math.max(1, Math.round(naturalHeight * scale));

  const detectCanvas = document.createElement("canvas");
  detectCanvas.width = dw;
  detectCanvas.height = dh;
  const dctx = detectCanvas.getContext("2d", { willReadFrequently: true });
  if (!dctx) {
    return manualResult("Canvas unavailable — draw blur boxes manually.");
  }
  dctx.drawImage(bitmap, 0, 0, dw, dh);

  // 1. Native FaceDetector (fast path).
  if (isFaceDetectorAvailable()) {
    try {
      const FD = (
        window as unknown as {
          FaceDetector: new (opts?: {
            maxDetectedFaces?: number;
            fastMode?: boolean;
          }) => {
            detect: (s: CanvasImageSource) => Promise<NativeDetectedFace[]>;
            release?: () => void;
          };
        }
      ).FaceDetector;
      const detector = new FD({ fastMode: false, maxDetectedFaces: 100 });
      const detected = await detector.detect(detectCanvas);
      try {
        detector.release?.();
      } catch {
        /* ignore */
      }
      if (detected.length > 0) {
        const faces = nms(
          toFaces(detected, dw, dh, naturalWidth, naturalHeight),
        );
        return buildResult(faces, true, "native");
      }
      // zero faces from native — try blazeface for robustness.
    } catch {
      // fall through to blazeface
    }
  }

  // 2. BlazeFace via TensorFlow.js (self-hosted model).
  //    Multi-scale: run on full image + 4 overlapping quadrants to catch
  //    small/distant faces in crowd scenes. BlazeFace downsamples to 128px
  //    internally, so quadrants (2x zoom) make small faces detectable.
  try {
    const fullFaces = await detectWithBlazeFace(
      detectCanvas,
      dw,
      dh,
      naturalWidth,
      naturalHeight,
    );
    // Run on quadrants for multi-scale detection (catches small faces).
    const quadFaces: FaceRegion[] = [];
    if (dw >= 400 && dh >= 400) {
      const hw = Math.floor(dw / 2);
      const hh = Math.floor(dh / 2);
      const overlap = 0.15; // 15% overlap between quadrants
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
          qctx.drawImage(detectCanvas, q.x, q.y, q.w, q.h, 0, 0, q.w, q.h);
          return detectWithBlazeFace(
            qc,
            q.w,
            q.h,
            naturalWidth,
            naturalHeight,
            q.x,
            q.y,
            dw,
            dh,
          );
        }),
      );
      quadFaces.push(...results.flat());
    }
    const allFaces = nms([...fullFaces, ...quadFaces], 0.4);
    return buildResult(allFaces, true, "blazeface");
  } catch {
    // fall through to manual
  }

  return manualResult(
    "Detection unavailable — draw blur boxes manually.",
  );
}

function buildResult(
  faces: FaceRegion[],
  available: boolean,
  engine: DetectionResult["engine"],
): DetectionResult {
  const note =
    faces.length > 0
      ? `${faces.length} face${faces.length > 1 ? "s" : ""} found`
      : "No faces found — draw boxes manually";
  return { faces, textRegions: [], available, engine, note };
}

function manualResult(note: string): DetectionResult {
  return { faces: [], textRegions: [], available: false, engine: "none", note };
}

function toFaces(
  detected: NativeDetectedFace[],
  dw: number,
  dh: number,
  naturalWidth: number,
  naturalHeight: number,
): FaceRegion[] {
  const upScaleX = naturalWidth / dw;
  const upScaleY = naturalHeight / dh;
  return detected.map((f, i) => {
    const b = f.boundingBox;
    const r: Rect = {
      x: b.left * upScaleX,
      y: b.top * upScaleY,
      width: b.width * upScaleX,
      height: b.height * upScaleY,
    };
    return {
      id: `face-n-${i}-${Math.round(r.x)}-${Math.round(r.y)}`,
      kind: "face",
      blurred: false,
      ...r,
    };
  });
}

/** Non-maximum suppression: remove boxes overlapping a higher-scoring one. */
function nms(faces: FaceRegion[], iouThreshold = 0.3): FaceRegion[] {
  const kept: FaceRegion[] = [];
  const suppressed = new Set<string>();
  for (let i = 0; i < faces.length; i++) {
    if (suppressed.has(faces[i].id)) continue;
    kept.push(faces[i]);
    for (let j = i + 1; j < faces.length; j++) {
      if (suppressed.has(faces[j].id)) continue;
      if (iou(faces[i], faces[j]) > iouThreshold) {
        suppressed.add(faces[j].id);
      }
    }
  }
  return kept;
}

function iou(a: Rect, b: Rect): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  const interW = Math.max(0, x1 - x0);
  const interH = Math.max(0, y1 - y0);
  const inter = interW * interH;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

// ---- BlazeFace (lazy-loaded) -------------------------------------------

interface BlazeFacePrediction {
  topLeft: [number, number];
  bottomRight: [number, number];
  probability?: number[] | { value: () => number };
}

interface BlazeFaceModel {
  estimateFaces: (
    input: CanvasImageSource,
    flipHorizontal?: boolean,
    returnTensors?: boolean,
    returnLandmarks?: boolean,
  ) => Promise<BlazeFacePrediction[]>;
  dispose?: () => void;
}

let blazefacePromise: Promise<BlazeFaceModel | null> | null = null;

async function loadBlazeFace(): Promise<BlazeFaceModel | null> {
  if (!blazefacePromise) {
    blazefacePromise = (async () => {
      const tf = await import("@tensorflow/tfjs");
      try {
        await tf.setBackend("webgl");
      } catch {
        /* ignore */
      }
      await tf.ready();
      const blazeface = await import("@tensorflow-models/blazeface");
      const model = await blazeface.load({
        maxFaces: 100,
        // Very low threshold (0.2) to catch small/distant faces in crowds.
        // NMS removes duplicates. False positives are preferable to missed
        // faces — the user can always erase unwanted blur regions.
        scoreThreshold: 0.2,
        // Self-hosted model — same origin, no third-party fetch.
        modelUrl: "/models/blazeface/model.json",
      });
      return model as unknown as BlazeFaceModel;
    })();
  }
  return blazefacePromise;
}

async function detectWithBlazeFace(
  canvas: HTMLCanvasElement,
  canvasW: number,
  canvasH: number,
  naturalWidth: number,
  naturalHeight: number,
  offsetX = 0,
  offsetY = 0,
  sourceW?: number,
  sourceH?: number,
): Promise<FaceRegion[]> {
  const model = await loadBlazeFace();
  if (!model) return [];

  const preds = await model.estimateFaces(canvas, false, false, false);
  // Scale from canvas coords to natural image coords.
  // For quadrants: canvasW/H is the quadrant size, sourceW/H is the full
  // detection canvas size. The quadrant was cropped from (offsetX, offsetY).
  const refW = sourceW ?? canvasW;
  const refH = sourceH ?? canvasH;
  const upScaleX = naturalWidth / refW;
  const upScaleY = naturalHeight / refH;

  const faces: FaceRegion[] = preds.map((p, i) => {
    const [tx, ty] = p.topLeft;
    const [bx, by] = p.bottomRight;
    // Add offset to translate quadrant coords back to full-canvas coords.
    const r: Rect = {
      x: (tx + offsetX) * upScaleX,
      y: (ty + offsetY) * upScaleY,
      width: (bx - tx) * upScaleX,
      height: (by - ty) * upScaleY,
    };
    return {
      id: `face-b-${offsetX}-${offsetY}-${i}-${Math.round(r.x)}-${Math.round(r.y)}`,
      kind: "face",
      blurred: false,
      ...r,
    };
  });

  return faces;
}
