// Minimal type declarations for the native FaceDetector API (experimental).
// Available in Chromium browsers; absent in Safari/Firefox.

interface DetectedFace {
  boundingBox: DOMRectReadOnly;
  landmarks: DOMRectReadOnly[];
}

interface FaceDetectorOptions {
  maxDetectedFaces?: number;
  fastMode?: boolean;
}

declare class FaceDetector {
  constructor(options?: FaceDetectorOptions);
  detect(input: ImageBitmapSource): Promise<DetectedFace[]>;
}

interface Window {
  FaceDetector?: typeof FaceDetector;
}

export {};
