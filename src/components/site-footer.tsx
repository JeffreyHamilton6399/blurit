const GITHUB_URL = "https://github.com/JeffreyHamilton6399";

/**
 * The one footer every Jeffrey Hamilton tool shares. Feedback deliberately
 * lives only in the header pill — one obvious entry point beats two quiet ones.
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
    </footer>
  );
}
