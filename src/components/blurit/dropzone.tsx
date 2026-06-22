"use client";

import * as React from "react";
import { ImagePlus, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPT_ATTR, isAccepted } from "@/lib/blurit/image";

interface DropzoneProps {
  onFile: (file: File) => void;
  onError: (message: string) => void;
  busy?: boolean;
}

export function Dropzone({ onFile, onError, busy }: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const handleFiles = React.useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!isAccepted(file)) {
        onError("Unsupported file. Use JPEG, PNG, WebP, HEIC, or BMP.");
        return;
      }
      onFile(file);
    },
    [onFile, onError],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (busy) return;
        handleFiles(e.dataTransfer.files);
      }}
      className="flex min-h-0 w-full flex-1 items-center justify-center p-3"
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          "border-border hover:border-emerald-500/60 hover:bg-emerald-500/[0.04]",
          dragging && "border-emerald-500 bg-emerald-500/[0.06]",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <ImagePlus className="size-6" />
        </span>
        <span className="space-y-1">
          <span className="block text-base font-semibold">
            Drop a photo
          </span>
          <span className="block text-sm text-muted-foreground">
            Blur faces and sensitive info before sharing — privately in your
            browser
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            or paste from clipboard
          </span>
        </span>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          No uploads · No sign-up · 100% free
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
