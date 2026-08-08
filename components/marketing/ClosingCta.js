import Link from "next/link";
import GithubButton from "./GithubButton";
import Reveal from "./Reveal";

export default function ClosingCta({ isSignedIn }) {
  return (
    <section className="border-t border-mkt-line">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24">
        <Reveal>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-mkt-text sm:text-3xl">
            Connect a repo. See what&apos;s already drifting.
          </h2>
        </Reveal>
        <Reveal delay={60} className="mt-6 flex flex-col items-center">
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-[10px] bg-mkt-signal px-4 text-sm font-medium text-white transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Go to dashboard
            </Link>
          ) : (
            <GithubButton />
          )}
          <p className="mt-3 text-xs text-mkt-muted">Free for one repository. No credit card.</p>
        </Reveal>
      </div>
    </section>
  );
}
