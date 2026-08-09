# Adding & Testing Additional Vendors

Driftwatch ships with two vendors registered in [`lib/vendors.js`](./lib/vendors.js):
**Stripe** (fully wired end-to-end) and **Twilio** (now wired for live
detection too — `specUrl: process.env.TWILIO_SPEC_URL` was added to its
entry; `TWILIO_SPEC_URL=` is present but **blank** in `.env.local`, so
Twilio is still skipped by `/api/check` until you fill in a real URL — see
Section 1). This doc is a step-by-step guide to:

1. Understand what "integrating a tool" actually means in this codebase.
2. Wire up a second vendor for live detection (using Twilio as the example).
3. Test each stage of the pipeline — scanning, detection, patch/ship — for
   more than one vendor at a time.

Read [CLAUDE.md](./CLAUDE.md) first if you haven't — it explains the
detect → match → patch → verify → ship pipeline and the 5-Gemini-call budget
per check run. This doc assumes that context.

---

## 0. The two halves of "integrating a vendor"

A vendor entry in `lib/vendors.js` feeds two independent pipeline stages,
and they have different requirements:

| Stage | File | Needs a `specUrl`? | Runs for every registered vendor automatically? |
|---|---|---|---|
| **Scan** — find call sites of the vendor's SDK/API in a repo | `lib/scanner.js` | No | **Yes** — loops over all of `VENDORS` |
| **Detect** — watch the vendor's changelog, classify diffs with Gemini | `lib/detect.js`, `app/api/check/route.js` | **Yes** | No — `app/api/check/route.js:24` does `VENDORS.filter(v => v.specUrl)`, so a vendor with no `specUrl` is silently skipped every run |

That's the whole reason Twilio wasn't checked live before: scanning already
indexed Twilio call sites in any connected repo, but `/api/check` never
classified Twilio changelog diffs because its vendor object had no
`specUrl`. The `specUrl` wiring is now in place (see Section 1) — the only
remaining step is to fill in `TWILIO_SPEC_URL` in `.env.local`.

---

## 1. Register (or complete) a vendor

Open [`lib/vendors.js`](./lib/vendors.js). Each entry looks like:

```js
{
  name: "Twilio",
  patterns: [/client\.(messages|calls)\.\w+\s*\(/g, /api\.twilio\.com\/[\w/.]+/g],
  fieldPatterns: [],                       // optional: bare-word field matches
  specUrl: process.env.TWILIO_SPEC_URL,    // wired; value comes from .env.local
  packageHints: ["twilio"],                // used to flag the vendor from package.json
}
```

Fields:

- **`name`** — display name, used everywhere (UI, PR titles, Gemini prompts).
- **`patterns`** — array of regexes matched against every scanned source
  file to find call sites. Use capture groups so the matched symbol is
  readable (see `lib/scanner.js`'s `scanFileForCallSites`).
- **`fieldPatterns`** *(optional)* — a second, independent regex pass for
  bare identifiers (e.g. `amount_captured`) that aren't full call
  expressions. Note per CLAUDE.md: patterns and fieldPatterns are
  independent passes, so a line can match both once each — this is
  intentional, not a bug.
- **`specUrl`** — the raw URL of the vendor's changelog/spec that
  `lib/detect.js` fetches and diffs. **This is the field that gates live
  detection.** Point it at plain text or Markdown, not a JS-rendered page —
  `fetchVendorSpec()` does a plain `fetch().text()`, no rendering.
- **`packageHints`** — lowercase package names checked against a repo's
  `package.json` dependencies to tag it as using this vendor even before
  any call sites are scanned (`buildIntegrations` in `lib/scanner.js`).

### Status: done, one step left

1. ✅ `lib/vendors.js` — Twilio's entry now has `specUrl: process.env.TWILIO_SPEC_URL`.
2. ✅ `.env.local` — a `TWILIO_SPEC_URL=` line was added, but it's **blank**.
3. ⬜ **You need to fill it in** with a real URL before Twilio is actually
   checked live:

   ```
   TWILIO_SPEC_URL=https://raw.githubusercontent.com/<owner>/<repo>/main/CHANGELOG.md
   ```

   Point it at any URL that returns plain text and changes over time. For
   a real test you can use Twilio's actual changelog; for a controlled
   demo, point it at a raw file in a scratch GitHub repo you control so you
   can edit it and trigger a "change" on demand. Then restart `npm run dev`
   (env vars are read at process start).

Until that URL is filled in, `specUrl` evaluates to `undefined` and Twilio
stays excluded from `/api/check`'s `VENDORS.filter(v => v.specUrl)` — same
as before, just one env var away from live now.

To add a brand-new vendor from scratch (not Twilio), add a whole new
object to the `VENDORS` array following the same shape — nothing else in
the codebase needs to change (scanner, detect, patch, and the UI are all
vendor-agnostic and iterate `VENDORS`).

---

## 2. Test scanning for multiple vendors (already works today)

No setup required — this loops over every registered vendor regardless of
`specUrl`.

```bash
# Optional but recommended: avoids GitHub's 60 req/hr anonymous cap
export GITHUB_TOKEN=ghp_your_pat_here     # PowerShell: $env:GITHUB_TOKEN="ghp_..."

node scripts/test-scan.js owner/repo
```

Pick (or create) a demo repo that uses **both** Stripe and Twilio so you
can see multi-vendor output in one run, e.g.:

```bash
node scripts/test-scan.js stripe-samples/accept-a-payment
```

Look at the JSON output's `integrations` array — each entry is one vendor
with its `callSiteCount` and the `file:line` list. If you want to verify
Twilio specifically, add a small snippet like `client.messages.create(...)`
to a scratch repo and re-run; you should see a `"vendor": "Twilio"` entry
appear.

You can also exercise this through the running app instead of the script:
sign in, connect a repo via **Connect a repo**, let the scan job finish
(`/api/scan/status` polling), then check `GET /api/integrations?repoId=...`
— it returns the same multi-vendor usage index that feeds `IntegrationPanel.js`.

---

## 3. Test live detection for multiple vendors

This is the part that was previously Stripe-only. Once **any** vendor has
a `specUrl` set (Section 1), it's automatically included in every
`/api/check` run — there's no per-vendor toggle in the UI, it's just
`VENDORS.filter(v => v.specUrl)`.

### 3a. Via the UI

1. `npm run dev`, sign in, connect a repo that has real (or seeded) Stripe
   and/or Twilio call sites.
2. Click **Run check now** on the dashboard (`DriftRail.js`).
3. The response covers every vendor with a `specUrl` in one call. Watch the
   per-vendor outcome badges — `unchanged`, `non-breaking`, `not-applicable`,
   `pr-opened`, or `error` — one per configured vendor.

### 3b. Via curl (faster iteration, no browser needed)

You still need a valid `gh_token` cookie (sign in once via the browser,
then copy the cookie value), or drive it from a script that owns the
cookie jar. For local iteration, the UI path is usually simpler than
fighting cookie auth in curl.

### Triggering an actual "change" to classify

`detectVendorChange()` does a **naive line-set diff** (`diffLines` in
`lib/detect.js`): any line present in the new fetch that wasn't present in
the last snapshot counts as new. To force a real detection (and therefore
a real Gemini classify call) for a vendor pointed at your own scratch repo:

1. Run one check first — this seeds `state.vendorSnapshots[vendor.name]`
   with the current spec text and reports `outcome: "unchanged"` (or
   whatever it currently is) with **zero** Gemini calls.
2. Edit the changelog file the `specUrl` points to — append a new line
   describing a breaking change, e.g.:
   ```
   - Removed support for `client.messages.create()`. Use `client.messages.createV2()` instead.
   ```
3. Run the check again. This time `diffLines` finds new lines, and
   `classifyChange()` makes one Gemini call per vendor that changed.

### Mind the budget

CLAUDE.md caps a full check run at **5 Gemini calls total** (1 classify +
up to 3 patch + up to 1 retry, in practice). That budget is *per run, across
all vendors checked in that run* — if you're testing Stripe and Twilio
together and both changed with matched call sites, you can exceed the
intended budget faster than testing one at a time. When iterating, prefer
changing (and testing) one vendor's spec at a time.

---

## 4. Test patch → verify → ship for a second vendor

`scripts/test-check.js` is **hardcoded to Stripe** — it doesn't call
`detectVendorChange()` at all, it skips straight to a literal
`hardcodedVendorChange` object and drives `matchAffectedCallSites` →
`patchAndShip`. There's no live spec fetch/diff in this script by design
(see its header comment — live diffing is exercised via `/api/check`
instead, per Section 3).

**`scripts/test-check-twilio.js` now exists**, mirroring that pattern for
Twilio. Differences from the Stripe script:

- Targets `nooraqib/driftwatch-demo`'s **`dev`** branch specifically
  (`branch = "dev"` — not the repo's default branch), and fails fast with a
  clear error if that branch doesn't exist yet.
- `hardcodedVendorChange` describes `client.messages.create` being
  deprecated in favor of `client.messages.createV2`.

**Before running it, the `dev` branch of `driftwatch-demo` needs a real
Twilio call site** (e.g. `client.messages.create(...)`) committed to it —
this script does not add one for you. Without that, `matchAffectedCallSites`
will correctly report 0 matches and stop (the intended "not applicable"
outcome, not a bug).

Run it the same way as the Stripe script:

```bash
node --env-file=.env.local scripts/test-check-twilio.js
```

Confirm: it should scan the `dev` branch, report matched Twilio call sites,
make one Gemini patch call per affected file (max 3), verify with
`@babel/parser`, and open a **draft** PR labeled `driftwatch` against `dev`.

This script uses `GITHUB_TOKEN` (a PAT), not the app's OAuth cookie flow —
same as the original `test-check.js`. Never commit that token or run this
against a repo you don't control; it opens a real PR.

---

## 5. Checklist: is a vendor "fully integrated"?

- [ ] Entry exists in `lib/vendors.js` with working `patterns` (verify with
      `scripts/test-scan.js` against a repo that uses it — call sites show up)
- [ ] `specUrl` is set and points to fetchable plain text/Markdown
- [ ] One `/api/check` run with an unchanged spec returns `outcome: "unchanged"`
      and costs 0 Gemini calls
- [ ] Editing the spec text and re-running produces a real classification
      (`outcome` becomes `non-breaking`, `not-applicable`, or leads to
      `pr-opened`) with exactly 1 Gemini call for the classify step
- [ ] When the classified change's `affectedSymbols` match real call sites
      in a connected repo, a draft PR is opened and `verifyPassed` is true
- [ ] When they don't match, the run stops at `not-applicable` — no PR

## 6. Troubleshooting

- **Vendor never shows up in `/api/check` results at all** — its `specUrl`
  is falsy. Check the env var is actually set and the dev server was
  restarted after editing `.env.local`.
- **`detectVendorChange` throws "No specUrl configured"** — you called it
  directly (e.g. in a custom script) for a vendor object that doesn't have
  one; guard with the same `VENDORS.filter(v => v.specUrl)` the route uses.
- **Scan finds 0 call sites for a vendor you know is used** — the regex in
  `patterns`/`fieldPatterns` doesn't match the repo's actual call style
  (e.g. destructured imports, aliased clients). Loosen or add a pattern and
  re-run `scripts/test-scan.js` to confirm before wiring up live detection.
- **Gemini call count higher than expected in one run** — remember the
  5-call budget is per `/api/check` call across *all* vendors with a
  `specUrl`, not per vendor. Testing two vendors' changes simultaneously
  roughly doubles the calls made in that run.
