import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VENDORS } from "@/lib/vendors";

export default async function Home({ searchParams }) {
  const store = await cookies();
  if (store.get("gh_token")) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const error = params?.error;

  return (
    <div className="instrument-grid flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-5xl grid-cols-1 items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <div className="flex items-center gap-2">
            <span className="rail-node-mark h-3 w-3" />
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">Driftwatch</p>
          </div>

          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Dependabot for every API you depend on.
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-ink/70 sm:text-lg">
            Vendor contract changes don&apos;t bump a version. Driftwatch watches them anyway — finds the exact
            call sites in your code, generates a fix, verifies it, and opens a draft pull request.
          </p>

          <div className="mt-8 max-w-md rounded-lg border border-line bg-surface p-5">
            <p className="text-sm leading-relaxed text-ink/70">
              Dependabot fires on a version bump. Your{" "}
              <code className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[0.85em]">
                package.json
              </code>{" "}
              did not change. Neither did your alerts.
            </p>
          </div>

          {error ? (
            <div className="mt-6 max-w-md rounded-lg border border-del/30 bg-del/5 p-4 text-sm text-del">{error}</div>
          ) : null}

          <a
            href="/api/auth/login"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-signal px-5 py-3 text-sm font-medium text-white transition-all hover:bg-signal/90 hover:-translate-y-px"
          >
            Sign in with GitHub
          </a>

          <p className="mt-6 font-mono text-xs text-ink/40">
            Watching {VENDORS.map((v) => v.name).join(" · ")}
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/40">Example run</p>

          <ul className="relative mt-4 flex flex-col gap-5 border-l-2 border-ink/80 pl-5">
            <li className="relative">
              <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-ink bg-paper" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-semibold text-ink">Stripe</span>
                <span className="rounded-full border border-del/40 bg-del/5 px-2 py-0.5 font-mono text-[11px] text-del">
                  high
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/80">Charges API removed in favor of Payment Intents.</p>
              <p className="mt-2 font-mono text-xs text-ink/50">server/payments.js:5</p>
              <p className="mt-1 text-xs font-medium text-add">Opened a draft pull request</p>
            </li>
            <li className="relative opacity-60">
              <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-ink bg-paper" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-semibold text-ink">Twilio</span>
                <span className="rounded-full border border-line bg-paper px-2 py-0.5 font-mono text-[11px] text-ink/60">
                  low
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/80">Message status webhook field renamed.</p>
              <p className="mt-2 font-mono text-xs text-ink/50">Detected, not applicable to your code</p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
