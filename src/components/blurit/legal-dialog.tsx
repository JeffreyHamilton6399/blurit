"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export type LegalKind = "privacy" | "terms" | null;

interface LegalDialogProps {
  kind: LegalKind;
  onClose: () => void;
}

export function LegalDialog({ kind, onClose }: LegalDialogProps) {
  return (
    <Dialog open={kind !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {kind === "privacy" ? "Privacy Policy" : "Terms of Use"}
          </DialogTitle>
          <DialogDescription>
            {kind === "privacy"
              ? "How BlurIt handles your data (spoiler: it doesn't)."
              : "The rules for using BlurIt."}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-3 text-sm text-muted-foreground">
            {kind === "privacy" ? <PrivacyBody /> : <TermsBody />}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function PrivacyBody() {
  return (
    <>
      <p>
        <strong className="text-foreground">No uploads. Ever.</strong> BlurIt
        is a fully client-side web application. Your photos are decoded,
        processed, and encoded entirely inside your browser. They are never
        transmitted to any server, including ours — there is no server.
      </p>
      <p>
        <strong className="text-foreground">No tracking, no analytics.</strong>{" "}
        BlurIt loads no third-party scripts, sets no tracking cookies, and
        collects no telemetry. There are no analytics SDKs, no ad pixels, and no
        fingerprinting.
      </p>
      <p>
        <strong className="text-foreground">Local storage only.</strong> The
        only things stored on your device are your theme preference and your
        one-time acceptance of these terms. Both live in{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">localStorage</code>{" "}
        and are never sent anywhere. Clearing your browser data removes them.
      </p>
      <p>
        <strong className="text-foreground">No accounts.</strong> There is
        nothing to sign up for and no personal information is ever requested.
      </p>
      <p>
        <strong className="text-foreground">Downloads.</strong> The protected
        photo you download is a normal file on your device. BlurIt does not
        retain a copy after you leave or open a new photo.
      </p>
      <p className="text-xs">
        Face detection uses your browser&apos;s built-in FaceDetector API where
        available. It runs locally on your device. No face data ever leaves your
        browser.
      </p>
    </>
  );
}

function TermsBody() {
  return (
    <>
      <p>
        <strong className="text-foreground">Free to use.</strong> BlurIt is
        provided free of charge. There are no paid tiers, upsells, or
        watermarks.
      </p>
      <p>
        <strong className="text-foreground">No warranty.</strong> BlurIt is
        provided &quot;as is&quot; without warranty of any kind. Blurring is a
        visual aid, not a guarantee of anonymity or privacy. You are responsible
        for verifying that sensitive information is adequately obscured before
        sharing.
      </p>
      <p>
        <strong className="text-foreground">Your responsibility.</strong> You
        are solely responsible for the photos you process and share, and for
        ensuring you have the right to do so. Do not use BlurIt to obscure
        information in a way that misleads or harms others.
      </p>
      <p>
        <strong className="text-foreground">No storage.</strong> BlurIt does not
        store, cache, or retain your photos. Once you leave or reset, the photo
        is gone from memory.
      </p>
      <p className="text-xs">
        By using BlurIt you agree to these terms. © Jeffrey Hamilton.
      </p>
    </>
  );
}
