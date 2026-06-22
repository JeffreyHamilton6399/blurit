// Face detection using the native FaceDetector API where available.
// Privacy-first: no third-party model fetch, no network. Falls back to
// manual-only mode on browsers without FaceDetector.

import type { DetectionResult, FaceRegion, Rect } from "./types";

function isFaceDetectorAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as GlobalFaceDetector).FaceDetector === "function"
  );
}

/**
 * Detect faces in an image. Detection runs on a downscaled bitmap for speed,
 * then boxes are scaled back up to natural image coordinates.
 */
export async function detectFaces(
  bitmap: ImageBitmap,
  naturalWidth: number,
  naturalHeight: number,
): Promise<DetectionResult> {
  if (!isFaceDetectorAvailable()) {
    return {
      faces: [],
      available: false,
      note: "Auto-detect unavailable in this browser — draw blur boxes manually.",
    };
  }

  try {
    // Downscale for fast, stable detection.
    const MAX = 1024;
    const scale =
      Math.max(naturalWidth, naturalHeight) > MAX
        ? MAX / Math.max(naturalWidth, naturalHeight)
        : 1;
    const dw = Math.max(1, Math.round(naturalWidth * scale));
    const dh = Math.max(1, Math.round(naturalHeight * scale));

    const detectCanvas = document.createElement("canvas");
    detectCanvas.width = dw;
    detectCanvas.height = dh;
    const dctx = detectCanvas.getContext("2d");
    if (!dctx) {
      return {
        faces: [],
        available: false,
        note: "Canvas unavailable — draw blur boxes manually.",
      };
    }
    dctx.drawImage(bitmap, 0, 0, dw, dh);

    const FD = (window as unknown as GlobalFaceDetector).FaceDetector!;
    const detector = new FD({ fastMode: true, maxDetectedFaces: 50 });
    const detected = await detector.detect(detectCanvas);

    const upScale = naturalWidth / dw;
    const faces: FaceRegion[] = detected.map((f, i) => {
      const b = f.boundingBox;
      const r: Rect = {
        x: b.left * upScale,
        y: b.top * upScale,
        width: b.width * upScale,
        height: b.height * upScale,
      };
      return {
        id: `face-${i}-${Math.round(r.x)}-${Math.round(r.y)}`,
        kind: "face",
        blurred: false,
        ...r,
      };
    });

    try {
      detector.release?.();
    } catch {
      /* ignore */
    }

    return {
      faces,
      available: true,
      note: faces.length > 0 ? `${faces.length} face${faces.length > 1 ? "s" : ""} found` : "No faces found — draw boxes manually",
    };
  } catch {
    return {
      faces: [],
      available: false,
      note: "Detection failed — draw blur boxes manually.",
    };
  }
}
