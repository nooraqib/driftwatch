import { cookies } from "next/headers";
import Link from "next/link";
import { GitPullRequestDraft, ShieldCheck, FileSearch, Ban } from "lucide-react";
import GithubButton from "@/components/marketing/GithubButton";
import PRCard from "@/components/marketing/PRCard";
import Reveal from "@/components/marketing/Reveal";
import ClosingCta from "@/components/marketing/ClosingCta";

export const metadata = {
  title: "Driftwatch — Dependabot for API vendors",
  description:
    "Your API broke. Your package.json didn't change. Driftwatch reads vendor changelogs, finds the exact lines in your repo that break, and opens the pull request that fixes them.",
};

const GAP_CARDS = [
  {
    title: "Dependabot & Renovate",
    body: "Fire when a package version changes. A vendor changing a response field on their own servers does not bump your version. Nothing fires.",
  },
  {
    title: "Changelog monitors",
    body: "Tell you something changed. They do not know which of your files use it, and they do not write the fix.",
  },
  {
    title: "Sentry & Datadog",
    body: "Excellent at telling you what broke. By then the payment already failed.",
  },
];

const STEPS = [
  {
    title: "Watch",
    body: "We poll the vendor's OpenAPI spec and changelog. Stripe publishes theirs on GitHub and updates it every release.",
  },
  {
    title: "Detect",
    body: "When the text changes, the model reads only the diff and returns structured JSON: is it breaking, how severe, which symbols are affected, what's the deadline.",
  },
  {
    title: "Locate",
    body: "We match those symbols against your repo's API usage index — every SDK call, endpoint string and response field, mapped to file and line.",
    callout: {
      title: "No match, no pull request.",
      body: "If a change doesn't touch code you actually run, we record it and stay quiet. You get fixes, not alerts.",
    },
  },
  {
    title: "Patch",
    body: "Only the affected files are rewritten. A syntax check runs before anything is committed. If it fails, the model gets the error back and retries.",
  },
  {
    title: "Ship",
    body: "A draft pull request, with the exact changelog line it came from, the affected call sites, and the deadline.",
  },
];

const TRUST_ITEMS = [
  { icon: GitPullRequestDraft, text: "Every pull request opens as a draft. Driftwatch never merges." },
  { icon: ShieldCheck, text: "Read-only on code. Write access limited to branches and pull requests." },
  { icon: FileSearch, text: "Every PR cites the exact changelog line it came from, so you can verify the reasoning." },
  { icon: Ban, text: "Patches that fail the syntax check are labelled unverified, not hidden." },
];

const AUDIENCE_ITEMS = [
  "Fintech and payments teams",
  "SaaS startups with 5–50 engineers",
  "Agencies maintaining many client codebases",
  "Platform and DevEx teams",
];

export default async function Home() {
  const store = await cookies();
  const isSignedIn = Boolean(store.get("gh_token"));

  return (
    <main>
      {/* 4.1 Hero */}
      <section id="product" className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-24 lg:py-32">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="inline-flex items-center rounded-full border border-mkt-line bg-mkt-surface px-3 py-1 font-mono text-xs text-mkt-muted">
              Dependabot for API vendors
            </span>

            <h1 className="mt-5 font-display text-[34px] font-semibold leading-[1.08] tracking-tight text-mkt-text sm:text-[56px]">
              Your API broke. Your package.json didn&apos;t change.
            </h1>

            <p className="mt-5 max-w-[620px] text-lg leading-relaxed text-mkt-muted">
              Stripe, Twilio and every other vendor ship breaking changes on their own schedule — with no version
              bump to trigger your alerts. Driftwatch reads the vendor changelog, finds the exact lines in your
              repo that break, and opens the pull request that fixes them.
            </p>

            <div className="mt-8">
              {isSignedIn ? (
                <Link
                  href="/dashboard"
                  className="inline-flex h-10 items-center justify-center rounded-[10px] bg-mkt-signal px-4 text-sm font-medium text-white transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  Go to dashboard
                </Link>
              ) : (
                <GithubButton trustLine />
              )}
            </div>
          </div>

          <PRCard />
        </div>
      </section>

      {/* 4.2 The gap */}
      <section className="border-t border-mkt-line">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-24">
          <Reveal>
            <h2 className="max-w-2xl font-display text-2xl font-semibold tracking-tight text-mkt-text sm:text-3xl">
              Three tools watch your dependencies. None watch your integrations.
            </h2>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {GAP_CARDS.map((card, i) => (
              <Reveal key={card.title} delay={i * 60}>
                <div className="h-full rounded-[10px] border border-mkt-line bg-mkt-surface p-5">
                  <h3 className="font-mono text-sm text-mkt-text">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mkt-muted">{card.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={180}>
            <p className="mt-8 font-medium text-mkt-signal">
              Driftwatch closes the loop: detect → locate → patch → verify → pull request.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 4.3 How it works */}
      <section className="border-t border-mkt-line">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-24">
          <Reveal>
            <h2 className="max-w-2xl font-display text-2xl font-semibold tracking-tight text-mkt-text sm:text-3xl">
              Five steps, and it stops early if your code isn&apos;t affected.
            </h2>
          </Reveal>

          <div className="relative mt-12">
            <div className="absolute bottom-4 left-4 top-4 w-px bg-mkt-line sm:hidden" />
            <div className="absolute left-0 right-0 top-4 hidden h-px bg-mkt-line sm:block" />
            <ol className="relative flex flex-col gap-8 sm:grid sm:grid-cols-5 sm:gap-6">
              {STEPS.map((step, i) => (
                <Reveal key={step.title} delay={i * 60}>
                  <li className="relative flex gap-4 sm:flex-col sm:gap-3">
                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-mkt-signal bg-mkt-bg font-mono text-xs text-mkt-signal">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-semibold text-mkt-text">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-mkt-muted">{step.body}</p>
                      {step.callout ? (
                        <div className="mt-3 rounded-[10px] border border-mkt-line bg-mkt-surface p-3">
                          <p className="font-mono text-xs font-medium text-mkt-text">{step.callout.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-mkt-muted">{step.callout.body}</p>
                        </div>
                      ) : null}
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 4.4 The usage index */}
      <section className="border-t border-mkt-line">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-24">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:items-center">
            <Reveal>
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-mkt-text sm:text-3xl">
                  We read your code, not just your version numbers.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-mkt-muted">
                  Before Driftwatch watches anything, it builds an index of every third-party API your repo
                  touches. This is what makes the difference between an alert and a fix.
                </p>
              </div>
            </Reveal>

            <Reveal delay={60}>
              <pre className="overflow-x-auto rounded-[10px] border border-mkt-line bg-mkt-surface p-5 font-mono text-xs leading-relaxed text-mkt-muted">
                {`Stripe        14 call sites   6 files
  lib/payments.js:5      stripe.charges.create
  lib/payments.js:11     charge.amount_captured
  services/billing.js:22 stripe.charges.create
Twilio         3 call sites   2 files
  lib/notify.js:8        client.messages.create`}
              </pre>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 4.5 Trust */}
      <section className="border-t border-mkt-line">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-24">
          <Reveal>
            <h2 className="max-w-2xl font-display text-2xl font-semibold tracking-tight text-mkt-text sm:text-3xl">
              Nothing merges without you.
            </h2>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {TRUST_ITEMS.map((item, i) => (
              <Reveal key={item.text} delay={i * 60}>
                <div className="flex items-start gap-3">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-mkt-signal" strokeWidth={1.75} />
                  <p className="text-sm leading-relaxed text-mkt-muted">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4.6 Who it's for */}
      <section className="border-t border-mkt-line">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-24">
          <Reveal>
            <h2 className="max-w-2xl font-display text-2xl font-semibold tracking-tight text-mkt-text sm:text-3xl">
              Built for teams whose revenue runs through someone else&apos;s API.
            </h2>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCE_ITEMS.map((item, i) => (
              <Reveal key={item} delay={i * 60}>
                <div className="rounded-[10px] border border-mkt-line bg-mkt-surface p-4">
                  <p className="text-sm font-medium text-mkt-text">{item}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={240}>
            <p className="mt-8 text-sm text-mkt-muted">
              The average enterprise manages over 900 APIs. Around 30% see a breaking change or deprecation in a
              given year.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 4.7 Closing CTA */}
      <ClosingCta isSignedIn={isSignedIn} />
    </main>
  );
}
