// Image decoding & encoding helpers. All client-side. No network.

import type { LoadedImage } from "./types";

const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/bmp",
];

export const ACCEPTED_TYPES = ACCEPTED;
export const ACCEPT_ATTR =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,image/bmp,.heic,.heif";

export function isAccepted(file: File): boolean {
  if (file.type && ACCEPTED.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return /\.(jpe?g|png|webp|heic|heif|bmp)$/.test(name);
}

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB — guard against mobile OOM.

function outputMimeFor(inputMime: string): string {
  switch (inputMime) {
    case "image/png":
      return "image/png";
    case "image/webp":
      return "image/webp";
    case "image/jpeg":
    case "image/heic":
    case "image/heif":
    case "image/bmp":
    default:
      return "image/jpeg";
  }
}

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** Strip the original extension and build a blurit- output filename. */
export function outputFileName(original: string, mime: string): string {
  const base = original.replace(/\.[^./\\]+$/, "").slice(0, 80) || "photo";
  return `${base}-blurit.${extFor(mime)}`;
}

/**
 * Decode a File into an ImageBitmap (off-main-thread where supported).
 * HEIC/HEIF are decoded via heic2any (lazy) since createImageBitmap cannot
 * decode them outside Safari.
 */
export async function decodeFile(file: File): Promise<LoadedImage> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Photo is larger than 20 MB. Try a smaller image.");
  }

  const inputMime = file.type || guessMime(file.name);
  const isHeic =
    inputMime === "image/heic" ||
    inputMime === "image/heif" ||
    /\.heic?$/.test(file.name.toLowerCase()) ||
    /\.heif$/i.test(file.name.toLowerCase());

  let bitmap: ImageBitmap;

  if (isHeic) {
    bitmap = await decodeHeic(file);
  } else {
    try {
      bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    } catch {
      // Fallback: <img> decode (handles BMP and odd cases).
      bitmap = await decodeViaImage(file);
    }
  }

  return {
    bitmap,
    naturalWidth: bitmap.width,
    naturalHeight: bitmap.height,
    fileName: file.name,
    mime: inputMime || "image/jpeg",
    outputMime: outputMimeFor(inputMime || "image/jpeg"),
  };
}

async function decodeHeic(file: File): Promise<ImageBitmap> {
  try {
    const mod = await import("heic2any");
    const heic2any = mod.default;
    const result = (await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    })) as Blob | Blob[];
    const blob = Array.isArray(result) ? result[0] : result;
    return await createImageBitmap(blob);
  } catch {
    throw new Error(
      "Could not decode this HEIC photo. Try converting it to JPEG first.",
    );
  }
}

async function decodeViaImage(file: File): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const bmp = await createImageBitmap(img, {
      imageOrientation: "from-image",
    });
    return bmp;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function guessMime(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".heic") || n.endsWith(".heif")) return "image/heic";
  if (n.endsWith(".bmp")) return "image/bmp";
  return "image/jpeg";
}

export interface EncodeOptions {
  mime: string;
  quality?: number;
}

/**
 * Encode a canvas to a Blob, choosing the best supported encoder.
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  opts: EncodeOptions,
): Promise<Blob> {
  const quality = opts.quality ?? 0.92;
  if (canvas instanceof OffscreenCanvas) {
    return await canvas.convertToBlob({ type: opts.mime, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode image."));
      },
      opts.mime,
      quality,
    );
  });
}
