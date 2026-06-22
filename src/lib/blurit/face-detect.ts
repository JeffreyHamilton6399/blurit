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
 * then boxes are scaled back up to natural image coordinates.
 */
export async function detectFaces(
  bitmap: ImageBitmap,
  naturalWidth: number,
  naturalHeight: number,
): Promise<DetectionResult> {
  // Downscaled detection canvas (also reused for BlazeFace).
  const MAX = 640;
  const scale =
    Math.max(naturalWidth, naturalHeight) > MAX
      ? MAX / Math.max(naturalWidth, naturalHeight)
      : 1;
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
      const detector = new FD({ fastMode: true, maxDetectedFaces: 50 });
      const detected = await detector.detect(detectCanvas);
      try {
        detector.release?.();
      } catch {
        /* ignore */
      }
      if (detected.length > 0) {
        return buildResult(
          toFaces(detected, dw, dh, naturalWidth, naturalHeight),
          true,
          "native",
        );
      }
      // zero faces from native — still report availability, try blazeface too
      // for robustness, but prefer the native answer.
      return buildResult([], true, "native");
    } catch {
      // fall through to blazeface
    }
  }

  // 2. BlazeFace via TensorFlow.js (self-hosted model).
  try {
    const faces = await detectWithBlazeFace(
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

  // 3. Manual only.
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
    engine === "native"
      ? faces.length > 0
        ? `${faces.length} face${faces.length > 1 ? "s" : ""} found`
        : "No faces found — draw boxes manually"
      : faces.length > 0
        ? `${faces.length} face${faces.length > 1 ? "s" : ""} found`
        : "No faces found — draw boxes manually";
  return { faces, available, engine, note };
}

function manualResult(note: string): DetectionResult {
  return { faces: [], available: false, engine: "none", note };
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
      // Prefer webgl; fall back to cpu for headless / non-GPU environments.
      try {
        await tf.setBackend("webgl");
      } catch {
        /* ignore */
      }
      await tf.ready();
      const blazeface = await import("@tensorflow-models/blazeface");
      const model = await blazeface.load({
        maxFaces: 50,
        scoreThreshold: 0.5,
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
  dw: number,
  dh: number,
  naturalWidth: number,
  naturalHeight: number,
): Promise<FaceRegion[]> {
  const model = await loadBlazeFace();
  if (!model) return [];

  const preds = await model.estimateFaces(canvas, false, false, false);
  const upScaleX = naturalWidth / dw;
  const upScaleY = naturalHeight / dh;

  const faces: FaceRegion[] = preds.map((p, i) => {
    const [tx, ty] = p.topLeft;
    const [bx, by] = p.bottomRight;
    const r: Rect = {
      x: tx * upScaleX,
      y: ty * upScaleY,
      width: (bx - tx) * upScaleX,
      height: (by - ty) * upScaleY,
    };
    return {
      id: `face-b-${i}-${Math.round(r.x)}-${Math.round(r.y)}`,
      kind: "face",
      blurred: false,
      ...r,
    };
  });

  return faces;
}
