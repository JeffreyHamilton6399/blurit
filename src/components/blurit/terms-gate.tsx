"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "blurit:terms-accepted-v1";

export function useTermsAccepted(): [boolean, () => void] {
  const [accepted, setAccepted] = React.useState(true);
  React.useEffect(() => {
    try {
      setAccepted(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setAccepted(false);
    }
  }, []);
  const accept = React.useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setAccepted(true);
  }, []);
  return [accepted, accept];
}

export function TermsGate() {
  const [accepted, accept] = useTermsAccepted();
  return (
    <Dialog open={!accepted}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-5" />
          </div>
          <DialogTitle>Your photos stay yours</DialogTitle>
          <DialogDescription>
            BlurIt runs entirely in your browser. Photos are never uploaded,
            stored, or sent anywhere — there are no servers involved.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-emerald-500">·</span>
            100% client-side. Zero network requests for your images.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500">·</span>
            No accounts, no sign-up, no tracking, no analytics.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500">·</span>
            Only your theme &amp; this acceptance are saved locally.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500">·</span>
            You&apos;re responsible for what you blur and share.
          </li>
        </ul>
        <Button
          onClick={accept}
          className="mt-1 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-600/90"
        >
          <ShieldCheck className="size-4" />
          I understand — start blurring
        </Button>
      </DialogContent>
    </Dialog>
  );
}
