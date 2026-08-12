import { FEEDBACK_MAILTO } from "@/components/feedback-button";

const GITHUB_URL = "https://github.com/JeffreyHamilton6399";

/**
 * The one footer every Jeffrey Hamilton tool shares: version, byline, and a
 * second way to reach the feedback inbox for anyone who scrolls past the
 * header button.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto flex h-8 shrink-0 items-center justify-center gap-1.5 border-t px-3 text-[11px] text-muted-foreground">
      <span>V1</span>
      <span className="opacity-40" aria-hidden>
        ·
      </span>
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium transition-colors hover:text-foreground"
      >
        Jeffrey Hamilton
      </a>
      <span className="opacity-40" aria-hidden>
        ·
      </span>
      <a
        href={FEEDBACK_MAILTO}
        className="transition-colors hover:text-foreground"
      >
        Feedback
      </a>
    </footer>
  );
}
