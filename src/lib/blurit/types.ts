// Shared types for BlurIt.

export type BlurIntensity = "light" | "medium" | "heavy";

export type BlurType = "pixelate" | "gaussian" | "black";

export type Tool = "select" | "brush" | "erase";

export interface Rect {
  /** x in natural image pixels */
  x: number;
  /** y in natural image pixels */
  y: number;
  width: number;
  height: number;
}

export interface FaceRegion extends Rect {
  id: string;
  kind: "face";
  blurred: boolean;
}

export interface ManualRegion extends Rect {
  id: string;
  kind: "manual";
}

export type AnyRegion = FaceRegion | ManualRegion;

export interface LoadedImage {
  bitmap: ImageBitmap;
  naturalWidth: number;
  naturalHeight: number;
  fileName: string;
  /** original mime type, e.g. image/jpeg */
  mime: string;
  /** output mime (heic -> jpeg) */
  outputMime: string;
}

export interface DetectionResult {
  faces: FaceRegion[];
  available: boolean;
  /** short human note about detection availability */
  note: string;
}
