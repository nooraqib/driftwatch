@AGENTS.md

# Driftwatch

"Dependabot for every API you depend on."

Dependabot fires on a package version bump. Driftwatch fires on a **vendor
contract change** — a third-party API (Stripe, Twilio, ...) changing behavior
in a way that produces no version bump and no `package.json` diff at all.

## What it does

1. Watch a vendor's spec/changelog for changes.
2. Diff the new text against the last-seen snapshot.
3. If it changed, ask Gemini to classify it: breaking? severity? which
   symbols are affected? (one Gemini call)
4. Look up those symbols in a repo's API usage index (built by scanning the
   repo's source over the GitHub REST API — no clone, no filesystem).
5. If nothing in the repo uses the affected symbols, **stop** — no PR, no
   noise. This "detected, not applicable" outcome is a feature, not a
   shortcut; it's the whole answer to alert fatigue.
6. If something matches, ask Gemini to rewrite the affected files (max 3,
   one call per file, one retry per file if the result fails to parse).
7. Verify the rewrite parses (`@babel/parser`).
8. Open a **draft** pull request via Octokit. Driftwatch never merges
   automatically.

`vendorChange` records are global, not per-repo: a vendor's changelog is
read once and fanned out to every connected repo whose usage index contains
the affected symbols. See `lib/store.js`.

## Stack

- Next.js App Router, JavaScript (not TypeScript), Tailwind v4
- `@octokit/rest` for all GitHub writes
- `@google/generative-ai`, model **`gemini-flash-latest`** by default, overridable via `GEMINI_MODEL` (see note below)
- Storage: one JSON file in `os.tmpdir()` + an in-memory cache, via
  `lib/store.js`'s `getState()`/`setState()`. No database. This is meant to
  be swapped for Postgres later without touching callers.
- Deploy target: Vercel (every route is designed to finish in well under the
  serverless timeout — long work is chunked and polled, never looped
  synchronously)

### Model name deviation

The original spec called for `gemini-2.5-flash`. That model returns a 404
("no longer available to new users") for the API key in use, even though it
still appears in `ListModels`. Both `lib/detect.js` and `lib/patch.js` default
to `gemini-flash-latest` instead — the alias Google points at its current
recommended flash model, chosen specifically so this doesn't silently break
again if the pinned version gets deprecated. Same cost/latency tier, same
budget assumptions.

The model name is overridable via the `GEMINI_MODEL` env var (falls back to
`gemini-flash-latest` if unset) so it can be swapped at runtime — e.g. when
`gemini-flash-latest`'s current underlying model (`gemini-3.6-flash` as of
this writing) hits its free-tier daily quota, without a code change. Each
model name is its own separate quota bucket, so switching immediately
unblocks testing. `.env.local` currently sets it to `gemini-flash-lite-latest`.

## Gemini call budget

A full check run (`POST /api/check`) must use **5 Gemini calls or fewer**:
1 call to classify a changelog diff, up to 3 calls to patch files (max 3
affected files), up to 3 retry calls if a patch fails to parse (in practice
retries are per-file and the loop still tops out well inside budget in the
demo scenarios). Never loop over files calling Gemini per file beyond the
3-file cap.

## File map

```
lib/
  vendors.js   Registry of watched vendors (Stripe, Twilio) — regex patterns
               for call-site detection, plus each vendor's specUrl.
               Adding a vendor is one object in this file.
  scanner.js   Builds a repo's API usage index purely via the GitHub REST
               API (tree -> filter -> blob fetch in batches of 20 -> regex
               match -> group by vendor). Exports both a full scanRepo()
               convenience wrapper and the underlying primitives
               (buildFileIndex, fetchFilesBatch, scanFileForCallSites,
               buildIntegrations) so the HTTP route can drive the same
               logic in 20-file batches instead of one long request.
  detect.js    Fetch a vendor spec, diff against the last snapshot, one
               Gemini call to classify the diff (breaking/severity/
               affectedSymbols/migration/...), and matchAffectedCallSites()
               to intersect those symbols against a repo's usage index.
  patch.js     For each affected file: fetch content, one Gemini call to
               rewrite it, verify with @babel/parser, one retry call on
               parse failure, then ship — create branch, commit each file,
               open a draft PR with a generated body, label it "driftwatch".
  gh.js        Shared GitHub API helper. Reads the signed-in user's token
               from the httpOnly gh_token cookie; every read in the app
               goes through this (writes go through Octokit, constructed
               with the same token).
  store.js     getState()/setState() over a JSON file in /tmp + in-memory
               cache. Swap point for a real database later.

app/
  page.js                        Landing page (redirects to /dashboard if
                                  already signed in).
  dashboard/page.js              Client component: auth check, repo list,
                                  scan polling, check pipeline, all wired
                                  to the real API routes below.
  dashboard/RepoRail.js          Left column: connected repos, status dot,
                                  disconnect control, "Connect a repo".
  dashboard/ConnectRepoModal.js  Picker listing the user's not-yet-
                                  connected GitHub repos.
  dashboard/DriftRail.js         Centre column: the Drift Rail (the one
                                  signature/animated element — see below),
                                  "Run check now", inline per-vendor outcome
                                  feedback after a check run.
  dashboard/IntegrationPanel.js  Right column: scan progress bar while
                                  scanning, else the vendor/call-site
                                  inventory (file:line, mono).

  api/auth/login, callback, me, logout   Hand-rolled GitHub OAuth (no
                                          NextAuth). See Auth below.
  api/repos                      GET  list the user's GitHub repos, merged
                                  with local connection state.
  api/repos/connect              POST { fullName } -> builds the file index
                                  and creates a scan job, returns jobId.
  api/repos/disconnect           POST { fullName } -> drops the repo's
                                  connection + usage index. Global vendor
                                  changes and past PRs are left untouched.
  api/scan/status                GET ?jobId= -> scans the next 20-file
                                  batch and returns live progress. Poll this
                                  until status:"done".
  api/integrations               GET ?repoId= -> that repo's usage index.
  api/check                      POST { repoId } -> runs detect -> match ->
                                  patch -> ship for every vendor that has a
                                  specUrl configured, returns every outcome
                                  (unchanged / non-breaking / not-applicable
                                  / pr-opened / error) so the UI never goes
                                  silent.
  api/changes                    GET -> all vendorChanges, newest first.
  api/prs                        GET ?repoId= -> driftwatch/* PRs live from
                                  GitHub for that repo; GET with no repoId
                                  -> locally cached PR records across repos.

scripts/
  test-scan.js    Standalone scanner verification against a public repo, no
                   server needed: node scripts/test-scan.js owner/repo
  test-check.js   Standalone full-pipeline verification (match -> patch ->
                   ship) against the demo repo, with a hardcoded vendor
                   change description rather than a live spec diff:
                   node --env-file=.env.local scripts/test-check.js
```

## Auth

Hand-rolled GitHub **OAuth App** flow (not a GitHub App, not NextAuth):

- `/api/auth/login` redirects to GitHub's authorize URL with a random
  `state`, stashed in a short-lived `gh_oauth_state` cookie.
- `/api/auth/callback` verifies `state`, exchanges `code` for an access
  token, sets it as an **httpOnly, sameSite=lax** `gh_token` cookie, redirects
  to `/dashboard`.
- `/api/auth/me` returns `{ login, avatarUrl }` or 401.
- `/api/auth/logout` clears the cookie.
- Every GitHub write in the app uses **the signed-in user's token** —
  there is no personal access token anywhere in the running app. (A PAT was
  used only for the one-off M2 verification script, `scripts/test-check.js`,
  against a throwaway demo repo — see below.)

## Design system

Deliberately "instrument panel," not a marketing site — quiet, precise,
confident. Full rationale and rules live in the original build brief; the
short version:

- Palette: `--ink #12161B`, `--paper #EDF0F2`, `--surface #FFFFFF`,
  `--line #D3DAE0`, `--signal #3B2FE8` (the one brand action color),
  `--warn #B5651D` (deprecation deadlines only), `--add #1A7F4B` /
  `--del #B3261E` (diff green/red — **only** inside diff-shaped content,
  never decoration). Defined as CSS custom properties in `app/globals.css`
  and exposed to Tailwind via `@theme inline`.
- Type: **Bricolage Grotesque** (`font-display`, headings/wordmark only),
  **Instrument Sans** (`font-sans`, body/UI), **JetBrains Mono**
  (`font-mono`, every file path, line number, symbol, branch name, diff —
  this is what makes it read as a real dev tool).
- Signature element: the **Drift Rail** (`dashboard/DriftRail.js`) — a
  vertical timeline with a 2px `--ink` rail; each vendor change is a node
  that expands to show affected call sites and any PRs it produced. A new
  node gets a one-time 600ms entrance animation (`rail-node-in` in
  `globals.css`, respects `prefers-reduced-motion`). This is the only
  animated moment in the app by design — everything else is static or a
  simple hover/focus state.
- Landing page hero doubles as a live example of the Drift Rail itself
  (`app/page.js`) rather than marketing copy, per "open with the most
  characteristic thing in the subject's world."

## Environment variables (`.env.local`, gitignored)

```
GITHUB_CLIENT_ID=          # GitHub OAuth App
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/callback
GEMINI_API_KEY=
VENDOR_SPEC_URL=           # raw URL of the changelog Driftwatch watches
```

`GITHUB_TOKEN` is also read by the two `scripts/*.js` verification scripts
(a classic/fine-grained PAT with `repo`-equivalent permissions), separately
from the app's own OAuth cookie flow. It is not read by any `app/api/*`
route.

## Build order followed

M1 scanner (no UI) -> M2 full pipeline to a real draft PR
(`nooraqib/driftwatch-demo`, verified against real Stripe call sites) -> M3
dashboard -> M4 GitHub OAuth login + landing page. M5 (live vendor spec
watching) is functionally in place via `lib/detect.js`'s diff-against-
snapshot logic, exercised through `/api/check`, but hasn't yet been given a
dedicated demo pass with a real breaking changelog entry. M6 (further
polish: severity badges and the "not applicable" state are done; deadline
display styling could go further) is partially done.

## Known simplifications, on purpose

- Job/store state lives in `/tmp` + memory, not a database — by design for
  the hackathon timeline, with `getState()`/`setState()` as the intended
  swap point.
- The scanner's `patterns` and `fieldPatterns` are independent passes, so a
  line can match twice (e.g. `stripe.charges.create(` matches both the
  method-call pattern and the bare-word `charges` field pattern). Left as
  spec'd; deduped only where it would otherwise show a duplicate line in a
  PR body (`lib/patch.js`'s `buildPrBody`).
- `matchAffectedCallSites` does substring-based normalization (strip
  trailing `(`/whitespace, check containment either direction) rather than
  exact symbol matching, since Gemini's `affectedSymbols` output and the
  scanner's captured `symbol` text won't always be byte-identical.
