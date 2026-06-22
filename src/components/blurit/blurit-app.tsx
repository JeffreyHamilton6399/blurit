"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "./logo";
import { Dropzone } from "./dropzone";
import { PhotoCanvas } from "./photo-canvas";
import { EditorToolbar } from "./editor-toolbar";
import { SettingsMenu, DONATE_URL } from "./settings-menu";
import { TermsGate } from "./terms-gate";
import { LegalDialog, type LegalKind } from "./legal-dialog";
import { decodeFile, canvasToBlob, outputFileName, isAccepted } from "@/lib/blurit/image";
import { detectFaces } from "@/lib/blurit/face-detect";
import { renderComposite } from "@/lib/blurit/blur";
import type {
  BlurIntensity,
  BlurType,
  FaceRegion,
  LoadedImage,
  ManualRegion,
  Rect,
  Tool,
} from "@/lib/blurit/types";

export function BlurItApp() {
  const { toast } = useToast();

  const [image, setImage] = React.useState<LoadedImage | null>(null);
  const [faces, setFaces] = React.useState<FaceRegion[]>([]);
  const [manualRegions, setManualRegions] = React.useState<ManualRegion[]>([]);
  const [blurType, setBlurType] = React.useState<BlurType>("pixelate");
  const [intensity, setIntensity] = React.useState<BlurIntensity>("medium");
  const [tool, setTool] = React.useState<Tool>("select");

  const [detecting, setDetecting] = React.useState(false);
  const [detectionNote, setDetectionNote] = React.useState("");
  const [detectionAvailable, setDetectionAvailable] = React.useState(true);
  const [downloading, setDownloading] = React.useState(false);
  const [legalKind, setLegalKind] = React.useState<LegalKind>(null);

  const manualIdRef = React.useRef(0);

  // ---- File loading ------------------------------------------------------
  const loadFile = React.useCallback(
    async (file: File) => {
      try {
        setDetecting(true);
        setFaces([]);
        setManualRegions([]);
        setDetectionNote("Loading…");
        const loaded = await decodeFile(file);
        setImage(loaded);
        setDetectionNote("Detecting faces…");
        const result = await detectFaces(
          loaded.bitmap,
          loaded.naturalWidth,
          loaded.naturalHeight,
        );
        setFaces(result.faces);
        setDetectionAvailable(result.available);
        setDetectionNote(result.note);
      } catch (e) {
        toast({
          title: "Could not load photo",
          description:
            e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
        setImage(null);
      } finally {
        setDetecting(false);
      }
    },
    [toast],
  );

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
            loadFile(file);
          }
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [image, loadFile]);

  // ---- Region editing ----------------------------------------------------
  const toggleFace = React.useCallback((id: string) => {
    setFaces((prev) =>
      prev.map((f) => (f.id === id ? { ...f, blurred: !f.blurred } : f)),
    );
  }, []);

  const unblurFace = React.useCallback((id: string) => {
    setFaces((prev) =>
      prev.map((f) => (f.id === id ? { ...f, blurred: false } : f)),
    );
  }, []);

  const addManual = React.useCallback((region: Rect) => {
    manualIdRef.current += 1;
    const id = `manual-${Date.now()}-${manualIdRef.current}`;
    setManualRegions((prev) => [...prev, { id, kind: "manual", ...region }]);
  }, []);

  const removeManual = React.useCallback((id: string) => {
    setManualRegions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearManual = React.useCallback(() => {
    setManualRegions([]);
  }, []);

  const blurAll = React.useCallback(() => {
    setFaces((prev) => prev.map((f) => ({ ...f, blurred: true })));
  }, []);

  // ---- New file / reset --------------------------------------------------
  const handleNew = React.useCallback(() => {
    setImage((prev) => {
      prev?.bitmap.close?.();
      return null;
    });
    setFaces([]);
    setManualRegions([]);
    setTool("select");
    setDetectionNote("");
  }, []);

  // Cleanup bitmap on unmount.
  React.useEffect(() => {
    return () => {
      setImage((prev) => {
        prev?.bitmap.close?.();
        return prev;
      });
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
  }, [image, faces, manualRegions, blurType, intensity, toast]);

  const blurredCount = faces.filter((f) => f.blurred).length;
  const unblurredFaces = faces.length - blurredCount;

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
          />
        </div>
      </header>

      {/* Main */}
      <main className="flex min-h-0 flex-1 flex-col px-3 py-2">
        {image ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <EditorToolbar
              tool={tool}
              setTool={setTool}
              blurType={blurType}
              setBlurType={setBlurType}
              intensity={intensity}
              setIntensity={setIntensity}
              onDownload={handleDownload}
              onNew={handleNew}
              onClearManual={clearManual}
              onBlurAll={blurAll}
              canBlurAll={unblurredFaces > 0}
              faceCount={faces.length}
              blurredCount={blurredCount}
              manualCount={manualRegions.length}
              detectionNote={detecting ? "Detecting faces…" : detectionNote}
              detectionAvailable={detectionAvailable}
              downloading={downloading}
            />
            <PhotoCanvas
              image={image}
              faces={faces}
              manualRegions={manualRegions}
              blurType={blurType}
              intensity={intensity}
              tool={tool}
              onToggleFace={toggleFace}
              onAddManual={addManual}
              onRemoveManual={removeManual}
              onUnblurFace={unblurFace}
            />
          </div>
        ) : (
          <Dropzone onFile={loadFile} onError={handleError} busy={detecting} />
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
