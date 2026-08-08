import { cookies } from "next/headers";
import { Check } from "lucide-react";
import GithubButton from "@/components/marketing/GithubButton";
import Reveal from "@/components/marketing/Reveal";
import ClosingCta from "@/components/marketing/ClosingCta";

export const metadata = {
  title: "Pricing — Driftwatch",
  description: "Priced per repository. Detection is shared across all customers, so you only pay for what runs against your code.",
};

const PLANS = [
  {
    name: "Free",
    price: "$0",
    priceNote: "forever",
    highlighted: false,
    forWhom: "Solo devs and side projects",
    features: ["1 repository", "3 tracked APIs", "Draft PRs", "Daily checks"],
    cta: "signin",
  },
  {
    name: "Starter",
    price: "$49",
    priceNote: "/mo · per repository",
    highlighted: false,
    forWhom: "One production app",
    features: ["Unlimited tracked APIs", "Hourly checks", "Deprecation calendar", "Email alerts"],
    cta: "signin",
  },
  {
    name: "Team",
    price: "$199",
    priceNote: "/mo · up to 10 repositories",
    highlighted: true,
    forWhom: "Growing engineering teams",
    features: [
      "Everything in Starter",
      "10 repositories",
      "Slack alerts",
      "Shared vendor watchlist",
      "Priority patch queue",
    ],
    cta: "signin",
  },
  {
    name: "Enterprise",
    price: "From $1,000",
    priceNote: "/mo · unlimited repositories",
    highlighted: false,
    forWhom: "Regulated and large orgs",
    features: [
      "Everything in Team",
      "SSO and SAML",
      "Audit log",
      "Private and internal vendor specs",
      "Self-hosted option",
      "Support SLA",
    ],
    cta: "talk",
  },
];

const FAQS = [
  {
    q: "What counts as a repository?",
    a: "One connected GitHub repo. Monorepos count as one, however many services live inside.",
  },
  {
    q: "Do you need write access to my code?",
    a: "We read your code and write only to new branches and pull requests. We never push to your default branch and never merge.",
  },
  {
    q: "What if the generated fix is wrong?",
    a: "Every PR is a draft and runs a syntax check first. If verification fails we still open it, clearly labelled unverified, so you decide. A patch you reject costs you a click. A missed deprecation costs you an outage.",
  },
  {
    q: "Which vendors are supported?",
    a: "We start with the vendors that break most often — Stripe, Twilio, Shopify, Meta, AWS. Any vendor publishing an OpenAPI spec or a changelog can be added, and Enterprise can add private internal specs.",
  },
  {
    q: "Why is this priced per repository and not per seat?",
    a: "The work scales with code, not headcount. We read each vendor's changelog once for every customer, so you only pay for what runs against your repositories.",
  },
];

export default async function Pricing() {
  const store = await cookies();
  const isSignedIn = Boolean(store.get("gh_token"));

  return (
    <main>
      <section className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-24">
        <Reveal>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-mkt-text sm:text-4xl">Pricing</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-mkt-muted">
            Priced per repository. Detection is shared across all customers, so we only charge for what runs
            against your code.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 60}>
              <div
                className={`flex h-full flex-col rounded-[10px] border p-5 ${
                  plan.highlighted ? "border-mkt-signal" : "border-mkt-line"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-sm text-mkt-text">{plan.name}</h2>
                  {plan.highlighted ? (
                    <span className="rounded-full border border-mkt-signal/40 bg-mkt-signal/10 px-2 py-0.5 font-mono text-[10px] text-mkt-signal">
                      Most popular
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-[36px] font-semibold tracking-tight text-mkt-text">
                    {plan.price}
                  </span>
                </div>
                <p className="text-xs text-mkt-muted">{plan.priceNote}</p>

                <p className="mt-4 text-sm text-mkt-muted">{plan.forWhom}</p>

                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-mkt-text">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mkt-signal" strokeWidth={2.25} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {plan.cta === "talk" ? (
                    <a
                      href="mailto:hello@driftwatch.dev"
                      className="flex h-10 w-full items-center justify-center rounded-[10px] border border-mkt-line text-sm font-medium text-mkt-text transition-colors hover:border-mkt-muted"
                    >
                      Talk to us
                    </a>
                  ) : isSignedIn ? (
                    <a
                      href="/dashboard"
                      className="flex h-10 w-full items-center justify-center rounded-[10px] bg-mkt-signal text-sm font-medium text-white transition-all hover:brightness-110 active:scale-[0.98]"
                    >
                      Go to dashboard
                    </a>
                  ) : (
                    <GithubButton className="w-full [&>button]:w-full" />
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={240}>
          <div className="mt-10 flex flex-col gap-2 border-t border-mkt-line pt-8 text-sm text-mkt-muted">
            <p>Extra monitored integrations beyond your plan · $9 per integration per month.</p>
            <p>Self-hosted licence for regulated industries · annual, contact us.</p>
          </div>
        </Reveal>
      </section>

      <section className="border-t border-mkt-line">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-24">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-mkt-text sm:text-3xl">
              Frequently asked
            </h2>
          </Reveal>

          <div className="mt-8 divide-y divide-mkt-line border-y border-mkt-line">
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 60}>
                <details className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-mkt-text">
                    {faq.q}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden="true"
                      className="shrink-0 text-mkt-muted transition-transform duration-200 group-open:rotate-180"
                    >
                      <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-mkt-muted">{faq.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <ClosingCta isSignedIn={isSignedIn} />
    </main>
  );
}
