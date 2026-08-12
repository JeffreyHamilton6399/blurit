"use client";

import * as React from "react";
import { FileText, ShieldCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FEEDBACK_EMAIL } from "@/components/feedback-button";

export type LegalKind = "privacy" | "terms";

const LAST_UPDATED = "June 2025";

/**
 * Prose styling lives here rather than in globals.css so this dialog is
 * self-contained and drops into any of the tools unchanged.
 */
const PROSE =
  "space-y-4 px-6 py-5 [&_h3]:pt-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:text-sm [&_ul]:text-muted-foreground [&_li]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-foreground";

function PrivacyBody() {
  return (
    <>
      <p>
        Your privacy is the whole point of BlurIt. This page explains exactly
        what happens when you use it.
      </p>

      <h3>We don’t see your photos. Ever.</h3>
      <p>Face detection, text detection, and blurring all run locally on your device. The detection models are downloaded to your browser and run there — your photos are never uploaded.</p>
      <p>Your photos are <strong>never uploaded to any server</strong>, never stored, and never transmitted across the network.</p>

      <h3>No accounts, no tracking identifiers</h3>
      <p>
        BlurIt does not require sign-up and does not use accounts. It sets no
        cookies that identify you, and collects no name, email, IP address, or
        other personal information.
      </p>

      <h3>What stays on your device</h3>
      <ul>
        <li>The photos you choose to work with.</li>
        <li>Any output you choose to save or download.</li>
        <li>Your theme preference, stored locally in your browser.</li>
      </ul>
      <p>
        Closing the tab discards everything from memory. Nothing is written to
        disk by BlurIt itself beyond what you explicitly save.
      </p>

      <h3>Analytics</h3>
      <p>
        BlurIt includes no third-party analytics and no advertising trackers.
        The host it is deployed on (Vercel) records aggregated, anonymous
        infrastructure metrics such as request counts; those never include your
        photos or their contents.
      </p>

      <h3>Children’s privacy</h3>
      <p>
        BlurIt is a general-purpose utility and does not knowingly collect
        data from anyone, including children.
      </p>

      <h3>Changes to this policy</h3>
      <p>
        If this ever changes, this page will be updated. Because the tool is built to run without a server, the core promise — your photos stay on your device — will not change.
      </p>

      <h3>Contact</h3>
      <p>
        BlurIt is open source. For questions about this policy, email{" "}
        <a
          href={`mailto:${FEEDBACK_EMAIL}`}
          className="font-medium text-foreground underline underline-offset-2"
        >
          {FEEDBACK_EMAIL}
        </a>{" "}
        or open an issue on GitHub.
      </p>
    </>
  );
}

function TermsBody() {
  return (
    <>
      <p>
        By using BlurIt, you agree to these terms. They’re short on purpose.
      </p>

      <h3>The service</h3>
      <p>
        BlurIt is a free, browser-based tool for blurring faces and sensitive details in photos. It is provided “as is” and “as available”,
        without warranties of any kind — express or implied — including
        warranties of merchantability or fitness for a particular purpose.
      </p>

      <h3>Your content, your responsibility</h3>
      <p>
        You are responsible for the photos you use with the tool. Because the
        work happens on your device, you keep full ownership and control of your
        content at all times. You agree that you have the rights to whatever you
        process with it.
      </p>

      <h3>Acceptable use</h3>
      <ul>
        <li>Don’t use BlurIt for anything you don’t have the right to do.</li>
        <li>Don’t attempt to abuse, overload, or reverse-engineer the hosting infrastructure.</li>
        <li>Don’t use the tool for any unlawful purpose.</li>
      </ul>

      <h3>Free and open</h3>
      <p>
        BlurIt is free to use. There are no paid tiers, no watermarks, and no
        usage limits imposed by the tool itself. The source is on GitHub — you
        are welcome to inspect, fork, or self-host it.
      </p>

      <h3>Limitation of liability</h3>
      <p>
        To the maximum extent permitted by law, the author shall not be liable
        for any indirect, incidental, special, or consequential damages arising
        from your use of the tool, including loss of data. Keep backups of
        anything you care about.
      </p>

      <h3>Third-party libraries</h3>
      <p>BlurIt is built on open-source libraries, including face-api.js, and Tesseract.js. Each is governed by its own license.</p>

      <h3>Changes</h3>
      <p>
        These terms may be updated from time to time. Continued use of
        BlurIt after a change constitutes acceptance of the updated terms.
      </p>
    </>
  );
}

/** The one legal dialog shared by every Jeffrey Hamilton tool. */
export function LegalDialog({
  kind,
  open,
  onOpenChange,
}: {
  kind: LegalKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isPrivacy = kind === "privacy";
  const Icon = isPrivacy ? ShieldCheck : FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Icon className="size-5 text-emerald-500" />
            {isPrivacy ? "Privacy Policy" : "Terms of Service"}
          </DialogTitle>
          <DialogDescription>Last updated: {LAST_UPDATED}</DialogDescription>
        </DialogHeader>
        <div className={`max-h-[65vh] overflow-y-auto ${PROSE}`}>
          {isPrivacy ? <PrivacyBody /> : <TermsBody />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
