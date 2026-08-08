import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-mkt-line">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-4 px-4 py-8 text-sm sm:flex-row sm:px-6">
        <span className="font-display text-mkt-text">Driftwatch — built at GDG Kolachi, 2026</span>
        <div className="flex items-center gap-6 text-mkt-muted">
          <Link
            href="https://github.com/nooraqib/driftwatch"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-mkt-text"
          >
            GitHub
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-mkt-text">
            Pricing
          </Link>
        </div>
      </div>
    </footer>
  );
}
