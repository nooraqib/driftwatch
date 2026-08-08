// The hero visual: a real mock pull request, not an illustration. This is
// the thing the page is actually selling — show it, don't describe it.
export default function PRCard() {
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-mkt-line bg-mkt-surface">
      <div className="absolute inset-x-0 top-0 h-px bg-mkt-signal" />

      <div className="flex items-center justify-between gap-3 border-b border-mkt-line px-4 py-3">
        <span className="min-w-0 truncate font-mono text-xs text-mkt-muted">
          driftwatch/stripe-charges-create <span className="text-mkt-muted/60">→</span> main
        </span>
        <span className="shrink-0 rounded-full border border-mkt-warn/40 bg-mkt-warn/10 px-2 py-0.5 font-mono text-[11px] text-mkt-warn">
          HIGH
        </span>
      </div>

      <div className="px-4 py-4">
        <p className="text-sm font-medium leading-snug text-mkt-text">
          Migrate stripe.charges.create() to paymentIntents
        </p>

        <div className="mt-3 overflow-hidden rounded-md border border-mkt-line bg-mkt-bg font-mono text-xs leading-relaxed">
          <div className="diff-line-del border-l-2 border-mkt-del bg-mkt-del/10 px-3 py-1.5 text-mkt-del">
            - const charge = await stripe.charges.create({"{"}
          </div>
          <div className="diff-line-add border-l-2 border-mkt-add bg-mkt-add/10 px-3 py-1.5 text-mkt-add">
            + const intent = await stripe.paymentIntents.create({"{"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-mkt-line px-4 py-3 font-mono text-[11px] text-mkt-muted">
        <span>lib/payments.js:5</span>
        <span className="text-mkt-line">·</span>
        <span>services/billing.js:22</span>
        <span className="text-mkt-line">·</span>
        <span className="text-mkt-add">✓ syntax check passed</span>
      </div>
    </div>
  );
}