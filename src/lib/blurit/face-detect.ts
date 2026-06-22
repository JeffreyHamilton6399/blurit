// Face detection.
// Engine priority: native FaceDetector API (Chrome/Edge, instant)
// -> @vladmandic/face-api SSD MobileNet V1 (all browsers, self-hosted)
// -> manual only.
//
// SSD MobileNet V1 is significantly more accurate than BlazeFace — it's a
// single-shot detector trained on faces at multiple scales, so it handles
// small/distant/partial faces in crowd scenes much better.
//
// Privacy: model weights load from the SAME ORIGIN (/models/face-api/).
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

export async function detectFaces(
  bitmap: ImageBitmap,
  naturalWidth: number,
  naturalHeight: number,
): Promise<DetectionResult> {
  // Use the full-resolution image (upscaled if small) for best detection.
  // SSD MobileNet handles multi-scale internally, so we don't need quadrants.
  const longest = Math.max(naturalWidth, naturalHeight);
  let scale = 1;
  // Upscale small images so faces are big enough.
  if (longest < 800) scale = 800 / longest;
  // Downscale huge images to cap memory/time.
  if (longest > 2000) scale = 2000 / longest;
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

  // 1. Native FaceDetector (fast path, Chrome/Edge).
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
    } catch {
      // fall through
    }
  }

  // 2. SSD MobileNet V1 via @vladmandic/face-api (self-hosted model).
  try {
    const faces = await detectWithSsdMobilenet(
      detectCanvas,
      dw,
      dh,
      naturalWidth,
      naturalHeight,
    );
    return buildResult(faces, true, "blazeface");
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

function nms(faces: FaceRegion[], iouThreshold = 0.4): FaceRegion[] {
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

// ---- SSD MobileNet V1 (lazy-loaded) ------------------------------------

interface FaceApiDetection {
  box: { x: number; y: number; width: number; height: number };
  score: number;
}

let modelPromise: Promise<boolean | null> | null = null;

async function loadModel(): Promise<boolean | null> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      // Self-hosted SSD MobileNet V1 model.
      await faceapi.nets.ssdMobilenetv1.loadFromUri("/models/face-api");
      return true;
    })();
  }
  return modelPromise;
}

async function detectWithSsdMobilenet(
  canvas: HTMLCanvasElement,
  dw: number,
  dh: number,
  naturalWidth: number,
  naturalHeight: number,
): Promise<FaceRegion[]> {
  const ready = await loadModel();
  if (!ready) return [];

  const faceapi = await import("@vladmandic/face-api");
  // Low minScore (0.15) to catch small/distant faces. NMS removes duplicates.
  const detections: FaceApiDetection[] = await faceapi.detectAllFaces(
    canvas,
    new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15, maxResults: 100 }),
  );

  const upScaleX = naturalWidth / dw;
  const upScaleY = naturalHeight / dh;

  const faces: FaceRegion[] = detections.map((d, i) => {
    const b = d.box;
    const r: Rect = {
      x: b.x * upScaleX,
      y: b.y * upScaleY,
      width: b.width * upScaleX,
      height: b.height * upScaleY,
    };
    return {
      id: `face-s-${i}-${Math.round(r.x)}-${Math.round(r.y)}`,
      kind: "face",
      blurred: false,
      ...r,
    };
  });

  return nms(faces);
}
