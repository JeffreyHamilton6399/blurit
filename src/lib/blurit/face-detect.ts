// Face detection.
// Engine priority: native FaceDetector API (Chrome/Edge, instant)
// -> SSD MobileNet V1 via face-api (loaded from CDN at runtime, model self-hosted)
// -> manual only.
//
// NOTE: The face-api library JS is loaded from a CDN at runtime (it's just
// code, not user data). The actual face-detection MODEL weights are
// self-hosted at /models/face-api/ (same origin). Your photo is NEVER sent
// anywhere — detection runs locally in the browser.

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
  if (longest < 800) scale = 800 / longest;
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

  // 2. SSD MobileNet V1 via face-api (CDN library, self-hosted model).
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

// ---- SSD MobileNet V1 via CDN-loaded face-api --------------------------

interface FaceApiDetection {
  box: { x: number; y: number; width: number; height: number };
  score: number;
}

interface FaceApiGlobal {
  nets: {
    ssdMobilenetv1: { loadFromUri: (url: string) => Promise<void> };
  };
  detectAllFaces: (
    input: CanvasImageSource,
    options?: unknown,
  ) => Promise<FaceApiDetection[]>;
  SsdMobilenetv1Options: new (opts: {
    minConfidence?: number;
    maxResults?: number;
  }) => unknown;
}

let faceApiPromise: Promise<FaceApiGlobal | null> | null = null;

async function loadFaceApi(): Promise<FaceApiGlobal | null> {
  if (faceApiPromise) return faceApiPromise;
  faceApiPromise = (async () => {
    // Load face-api library from CDN (code only, not user data).
    await new Promise<void>((resolve, reject) => {
      if ((window as unknown as { faceapi?: unknown }).faceapi) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("face-api CDN load failed"));
      document.head.appendChild(script);
    })();
    const faceapi = (window as unknown as { faceapi: FaceApiGlobal }).faceapi;
    // Self-hosted model weights (same origin).
    await faceapi.nets.ssdMobilenetv1.loadFromUri("/models/face-api");
    return faceapi;
  })();
  return faceApiPromise;
}

async function detectWithSsdMobilenet(
  canvas: HTMLCanvasElement,
  dw: number,
  dh: number,
  naturalWidth: number,
  naturalHeight: number,
): Promise<FaceRegion[]> {
  const faceapi = await loadFaceApi();
  if (!faceapi) return [];

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
