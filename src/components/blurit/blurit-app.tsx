"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "./logo";
import { Dropzone } from "./dropzone";
import { PhotoCanvas } from "./photo-canvas";
import { EditorSidebar } from "./editor-sidebar";
import { SettingsMenu, DONATE_URL } from "./settings-menu";
import { TermsGate } from "./terms-gate";
import { LegalDialog, type LegalKind } from "./legal-dialog";
import { decodeFile, canvasToBlob, outputFileName, isAccepted } from "@/lib/blurit/image";
import { detectFaces } from "@/lib/blurit/face-detect";
import { detectText, terminateTextWorker } from "@/lib/blurit/text-detect";
import { renderComposite } from "@/lib/blurit/blur";
import type {
  BlurIntensity,
  BlurType,
  DetectionModes,
  FaceRegion,
  LoadedImage,
  ManualRegion,
  Rect,
  RegionShape,
  TextRegion,
  Tool,
} from "@/lib/blurit/types";

const MODES_KEY = "blurit:detection-modes-v1";

function loadModes(): DetectionModes {
  try {
    const raw = localStorage.getItem(MODES_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<DetectionModes>;
      return {
        faces: p.faces !== false,
        text: p.text === true,
      };
    }
  } catch {
    /* ignore */
  }
  return { faces: true, text: false };
}

export function BlurItApp() {
  const { toast } = useToast();

  const [image, setImage] = React.useState<LoadedImage | null>(null);
  const [faces, setFaces] = React.useState<FaceRegion[]>([]);
  const [textRegions, setTextRegions] = React.useState<TextRegion[]>([]);
  const [manualRegions, setManualRegions] = React.useState<ManualRegion[]>([]);
  const [blurType, setBlurType] = React.useState<BlurType>("pixelate");
  const [intensity, setIntensity] = React.useState<BlurIntensity>("medium");
  const [tool, setTool] = React.useState<Tool>("select");
  const [brushShape, setBrushShape] = React.useState<RegionShape>("rect");

  const [modes, setModes] = React.useState<DetectionModes>({
    faces: true,
    text: false,
  });
  const [modesReady, setModesReady] = React.useState(false);

  const [detecting, setDetecting] = React.useState(false);
  const [detectionNote, setDetectionNote] = React.useState("");
  const [downloading, setDownloading] = React.useState(false);
  const [legalKind, setLegalKind] = React.useState<LegalKind>(null);

  const manualIdRef = React.useRef(0);
  const runIdRef = React.useRef(0);

  // Load persisted detection modes on mount.
  React.useEffect(() => {
    setModes(loadModes());
    setModesReady(true);
  }, []);

  // Persist detection modes.
  React.useEffect(() => {
    if (!modesReady) return;
    try {
      localStorage.setItem(MODES_KEY, JSON.stringify(modes));
    } catch {
      /* ignore */
    }
  }, [modes, modesReady]);

  // ---- File loading + detection -----------------------------------------
  const runDetection = React.useCallback(
    async (loaded: LoadedImage, currentModes: DetectionModes) => {
      const myRun = ++runIdRef.current;
      setFaces([]);
      setTextRegions([]);
      setDetecting(true);

      const notes: string[] = [];
      let anyAvailable = false;

      if (currentModes.faces) {
        setDetectionNote("Detecting faces…");
        try {
          const result = await detectFaces(
            loaded.bitmap,
            loaded.naturalWidth,
            loaded.naturalHeight,
          );
          if (myRun !== runIdRef.current) return; // superseded
          setFaces(result.faces);
          if (result.available) {
            anyAvailable = true;
            notes.push(
              result.faces.length > 0
                ? `${result.faces.length} face${result.faces.length > 1 ? "s" : ""}`
                : "No faces",
            );
          } else {
            notes.push("Face detect off");
          }
        } catch {
          notes.push("Face detect failed");
        }
      } else {
        notes.push("Faces off");
      }

      if (currentModes.text) {
        setDetectionNote(
          notes.length > 0 ? `${notes.join(" · ")} · scanning text…` : "Scanning text…",
        );
        try {
          const text = await detectText(
            loaded.bitmap,
            loaded.naturalWidth,
            loaded.naturalHeight,
          );
          if (myRun !== runIdRef.current) return; // superseded
          setTextRegions(text);
          anyAvailable = true;
          notes.push(
            text.length > 0
              ? `${text.length} text${text.length > 1 ? "s" : ""}`
              : "No text",
          );
        } catch {
          notes.push("Text detect failed");
        }
      }

      if (myRun !== runIdRef.current) return;
      setDetecting(false);

      if (!anyAvailable) {
        setDetectionNote("Detection off — draw blur boxes manually.");
      } else {
        setDetectionNote(
          notes.length > 0 ? notes.join(" · ") : "Detection complete",
        );
      }
    },
    [],
  );

  const loadFile = React.useCallback(
    async (file: File, currentModes: DetectionModes) => {
      try {
        setDetecting(true);
        setManualRegions([]);
        setDetectionNote("Loading…");
        const loaded = await decodeFile(file);
        setImage(loaded);
        await runDetection(loaded, currentModes);
      } catch (e) {
        toast({
          title: "Could not load photo",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
        setImage(null);
        setDetecting(false);
      }
    },
    [runDetection, toast],
  );

  // Re-run detection when modes change AND an image is loaded.
  React.useEffect(() => {
    if (!image || !modesReady) return;
    runDetection(image, modes);
    // We intentionally exclude runDetection from deps to avoid loops; it's
    // stable-ish (only depends on setState which is stable).
  }, [modes, modesReady]);

  const handleError = React.useCallback(
    (message: string) => {
      toast({ title: "Unsupported file", description: message, variant: "destructive" });
    },
    [toast],
  );

  // ---- Paste from clipboard (empty state only) ---------------------------
  React.useEffect(() => {
    if (image) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file && isAccepted(file)) {
            e.preventDefault();
            loadFile(file, modes);
          }
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [image, loadFile, modes]);

  // ---- Region editing ----------------------------------------------------
  const toggleFace = React.useCallback((id: string) => {
    setFaces((prev) =>
      prev.map((f) => (f.id === id ? { ...f, blurred: !f.blurred } : f)),
    );
  }, []);

  const toggleText = React.useCallback((id: string) => {
    setTextRegions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, blurred: !t.blurred } : t)),
    );
  }, []);

  const unblurFace = React.useCallback((id: string) => {
    setFaces((prev) =>
      prev.map((f) => (f.id === id ? { ...f, blurred: false } : f)),
    );
  }, []);

  const unblurText = React.useCallback((id: string) => {
    setTextRegions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, blurred: false } : t)),
    );
  }, []);

  const addManual = React.useCallback((region: Rect, shape: RegionShape) => {
    manualIdRef.current += 1;
    const id = `manual-${Date.now()}-${manualIdRef.current}`;
    setManualRegions((prev) => [
      ...prev,
      { id, kind: "manual", shape, ...region },
    ]);
  }, []);

  const removeManual = React.useCallback((id: string) => {
    setManualRegions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearManual = React.useCallback(() => {
    setManualRegions([]);
  }, []);

  const blurAll = React.useCallback(() => {
    setFaces((prev) => prev.map((f) => ({ ...f, blurred: true })));
    setTextRegions((prev) => prev.map((t) => ({ ...t, blurred: true })));
  }, []);

  // ---- New file / reset --------------------------------------------------
  const handleNew = React.useCallback(() => {
    runIdRef.current++; // invalidate any in-flight detection
    setImage((prev) => {
      prev?.bitmap.close?.();
      return null;
    });
    setFaces([]);
    setTextRegions([]);
    setManualRegions([]);
    setTool("select");
    setDetectionNote("");
    setDetecting(false);
  }, []);

  // Cleanup bitmap + OCR worker on unmount.
  React.useEffect(() => {
    return () => {
      setImage((prev) => {
        prev?.bitmap.close?.();
        return prev;
      });
      terminateTextWorker();
    };
  }, []);

  // ---- Download / export -------------------------------------------------
  const handleDownload = React.useCallback(async () => {
    if (!image) return;
    setDownloading(true);
    try {
      const MAX = 4096;
      const longest = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = longest > MAX ? MAX / longest : 1;
      const exW = Math.round(image.naturalWidth * scale);
      const exH = Math.round(image.naturalHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = exW;
      canvas.height = exH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not available");

      const sx = exW / image.naturalWidth;
      const sy = exH / image.naturalHeight;
      const regions = [
        ...faces.map((f) => ({
          region: {
            x: f.x * sx,
            y: f.y * sy,
            width: f.width * sx,
            height: f.height * sy,
          },
          blurred: f.blurred,
          isFace: true,
          shape: "ellipse" as RegionShape,
        })),
        ...textRegions.map((t) => ({
          region: {
            x: t.x * sx,
            y: t.y * sy,
            width: t.width * sx,
            height: t.height * sy,
          },
          blurred: t.blurred,
          isFace: false,
          shape: "rect" as RegionShape,
        })),
        ...manualRegions.map((m) => ({
          region: {
            x: m.x * sx,
            y: m.y * sy,
            width: m.width * sx,
            height: m.height * sy,
          },
          blurred: true,
          isFace: false,
          shape: m.shape,
        })),
      ];

      renderComposite(
        ctx,
        image.bitmap,
        image.naturalWidth,
        image.naturalHeight,
        exW,
        exH,
        regions,
        { blurType, intensity },
      );

      const blob = await canvasToBlob(canvas, {
        mime: image.outputMime,
        quality: 0.92,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outputFileName(image.fileName, image.outputMime);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast({
        title: "Photo protected",
        description: "Saved to your device — safe to share.",
      });
    } catch (e) {
      toast({
        title: "Download failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  }, [image, faces, textRegions, manualRegions, blurType, intensity, toast]);

  const blurredFaceCount = faces.filter((f) => f.blurred).length;
  const blurredTextCount = textRegions.filter((t) => t.blurred).length;
  const unblurredDetected =
    faces.length - blurredFaceCount + (textRegions.length - blurredTextCount);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <Logo />
        <div className="flex items-center gap-1">
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 rounded-full px-3 text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400"
          >
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Donate"
            >
              <Heart className="size-3.5" />
              <span className="text-xs font-medium">Donate</span>
            </a>
          </Button>
          <SettingsMenu
            onOpenPrivacy={() => setLegalKind("privacy")}
            onOpenTerms={() => setLegalKind("terms")}
            modes={modes}
            setModes={setModes}
          />
        </div>
      </header>

      {/* Main */}
      <main className="flex min-h-0 flex-1">
        {image ? (
          <>
            <EditorSidebar
              tool={tool}
              setTool={setTool}
              blurType={blurType}
              setBlurType={setBlurType}
              intensity={intensity}
              setIntensity={setIntensity}
              brushShape={brushShape}
              setBrushShape={setBrushShape}
              onDownload={handleDownload}
              onNew={handleNew}
              onClearManual={clearManual}
              onBlurAll={blurAll}
              canBlurAll={unblurredDetected > 0}
              faceCount={faces.length}
              blurredFaceCount={blurredFaceCount}
              textCount={textRegions.length}
              blurredTextCount={blurredTextCount}
              manualCount={manualRegions.length}
              detectionNote={detectionNote}
              detecting={detecting}
              downloading={downloading}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2">
              <PhotoCanvas
                image={image}
                faces={faces}
                textRegions={textRegions}
                manualRegions={manualRegions}
                blurType={blurType}
                intensity={intensity}
                tool={tool}
                brushShape={brushShape}
                onToggleFace={toggleFace}
                onToggleText={toggleText}
                onAddManual={addManual}
                onRemoveManual={removeManual}
                onUnblurFace={unblurFace}
                onUnblurText={unblurText}
              />
              {/* Detection status bar */}
              <div className="flex shrink-0 items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                {detecting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                    {detectionNote || "Scanning…"}
                  </span>
                ) : (
                  <>
                    <span
                      className={
                        faces.length > 0 || textRegions.length > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : ""
                      }
                    >
                      {detectionNote}
                    </span>
                    {(faces.length > 0 || textRegions.length > 0 || manualRegions.length > 0) && (
                      <span className="text-border">·</span>
                    )}
                    {faces.length > 0 && (
                      <span>
                        {faces.length} face{faces.length > 1 ? "s" : ""}
                        {blurredFaceCount > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {" "}· {blurredFaceCount} blurred
                          </span>
                        )}
                      </span>
                    )}
                    {textRegions.length > 0 && (
                      <span>
                        {textRegions.length} text{textRegions.length > 1 ? "s" : ""}
                        {blurredTextCount > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {" "}· {blurredTextCount} blurred
                          </span>
                        )}
                      </span>
                    )}
                    {manualRegions.length > 0 && (
                      <span>
                        {manualRegions.length} manual
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <Dropzone
            onFile={(f) => loadFile(f, modes)}
            onError={handleError}
            busy={detecting}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="flex h-8 shrink-0 items-center justify-center border-t px-3 text-xs text-muted-foreground">
        V1 · Jeffrey Hamilton
      </footer>

      <TermsGate />
      <LegalDialog kind={legalKind} onClose={() => setLegalKind(null)} />
    </div>
  );
}
