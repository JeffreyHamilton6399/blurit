import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Where feedback goes. Shared by every Jeffrey Hamilton tool. */
export const FEEDBACK_EMAIL = "jeffreyscotthamilton6399@gmail.com";

/** This app's name — used in the prefilled subject line. */
export const FEEDBACK_APP_NAME = "BlurIt";

const BODY = [
  `Feedback for ${FEEDBACK_APP_NAME} — bugs, ideas, or whatever you'd like to see next.`,
  "",
  "What happened / what you'd change:",
  "",
  "",
  "Browser & device (optional):",
  "",
].join("\n");

/** Prefilled mailto, exported so footers and menus can reuse the same link. */
export const FEEDBACK_MAILTO =
  `mailto:${FEEDBACK_EMAIL}` +
  `?subject=${encodeURIComponent(`Feedback: ${FEEDBACK_APP_NAME}`)}` +
  `&body=${encodeURIComponent(BODY)}`;

/**
 * "Feedback" pill for the app header.
 *
 * Deliberately mirrors the rose Donate pill — same height, radius, and
 * padding — so the two read as one set: blue asks for words, rose asks for
 * money. The label stays visible at every breakpoint (Donate's label is the
 * one that collapses on mobile) because feedback is the ask we care about.
 */
export function FeedbackButton({ className }: { className?: string }) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn(
        "h-7 gap-1.5 rounded-full border-blue-200 px-3 text-xs font-medium text-blue-600",
        "hover:bg-blue-50 hover:text-blue-700",
        "dark:border-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300",
        className,
      )}
    >
      <a href={FEEDBACK_MAILTO} aria-label="Give feedback by email">
        <MessageSquarePlus className="size-3.5" />
        <span>Feedback</span>
      </a>
    </Button>
  );
}
