# Driftwatch

**Dependabot for every API you depend on.**

Dependabot fires when a package version bumps. Driftwatch fires when a
third-party API (Stripe, Twilio, ...) changes its *behavior* — something
that produces no version bump and no `package.json` diff at all.

Driftwatch watches a vendor's changelog, finds the exact places in your
codebase that use whatever changed, generates a fix, verifies it, and opens
a **draft** pull request. It never merges automatically.

## How it works

```
Watch vendor spec/changelog
        |  diff against last snapshot
Detect  -> Gemini classifies: breaking? severity? affected symbols?
        |
Match   -> look up affected symbols in the repo's API usage index
        |  no match = stop, no PR, no noise
Patch   -> Gemini rewrites only the affected files
        |
Verify  -> syntax check; on failure, retry once with the error
        |
Ship    -> open a draft pull request on a new branch
```

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment variables below into `.env.local` and fill them in.

3. Run the dev server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000), sign in with GitHub,
   connect a repo, and click **Run check now**.

## Environment variables

```
GITHUB_CLIENT_ID=          # from a GitHub OAuth App
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/callback
GEMINI_API_KEY=            # from aistudio.google.com/apikey
VENDOR_SPEC_URL=           # raw URL of the changelog to watch
```

`GITHUB_CALLBACK_URL` must exactly match the callback URL configured on the
GitHub OAuth App itself (**GitHub Settings → Developer settings → OAuth
Apps**).

## Verifying the pipeline without the UI

Two standalone scripts exercise the core logic directly, without a running
server:

```bash
# Print a repo's API usage index (file, line, matched symbol) as JSON
node scripts/test-scan.js owner/repo

# Run the full match -> patch -> verify -> ship pipeline against the demo
# repo, using a hardcoded vendor-change description
node --env-file=.env.local scripts/test-check.js
```

## Adding & testing more vendors

Twilio is now wired the same way Stripe is — set `TWILIO_SPEC_URL` in
`.env.local` to enable live change detection for it (it's present but
blank by default). See [MULTI_VENDOR_TESTING.md](./MULTI_VENDOR_TESTING.md)
for the full step-by-step guide to testing scanning, detection, and
patch/ship across multiple vendors at once.

## Project structure

See [CLAUDE.md](./CLAUDE.md) for a full breakdown of the codebase, the
design system, and the decisions behind them.

## Stack

Next.js (App Router, JavaScript), Tailwind CSS, `@octokit/rest`,
`@google/generative-ai` (`gemini-flash-latest`), and a JSON-file-in-`/tmp`
store — no database. Deploys to Vercel.
