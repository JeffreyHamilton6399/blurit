// Shared types for BlurIt.

export type BlurIntensity = "light" | "medium" | "heavy";

export type BlurType = "pixelate" | "gaussian" | "black";

export type Tool = "select" | "brush" | "erase";

/** Shape of a blur region. Faces always render as ellipse (circle). */
export type RegionShape = "rect" | "ellipse";

export interface Rect {
  /** x in natural image pixels */
  x: number;
  /** y in natural image pixels */
  y: number;
  width: number;
  height: number;
}

/** Kind of auto-detected region (used for badges + coloring). */
export type DetectionKind = "face" | "text";

export interface FaceRegion extends Rect {
  id: string;
  kind: "face";
  blurred: boolean;
}

export interface ManualRegion extends Rect {
  id: string;
  kind: "manual";
  shape: RegionShape;
}

export type AnyRegion = FaceRegion | ManualRegion | TextRegion;

export interface TextRegion extends Rect {
  id: string;
  kind: "text";
  /** what the OCR read (license plate, address fragment, etc.) */
  label: string;
  blurred: boolean;
}

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

/** Which detectors are enabled by the user (settings). */
export interface DetectionModes {
  faces: boolean;
  text: boolean;
}

export interface DetectionResult {
  faces: FaceRegion[];
  textRegions: TextRegion[];
  available: boolean;
  /** which engine produced the result */
  engine: "native" | "blazeface" | "none";
  /** short human note about detection availability */
  note: string;
}
