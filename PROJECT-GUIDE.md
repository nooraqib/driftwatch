# Driftwatch — Project Guide

This document explains the project in full detail: what it does, how the
backend works, how the frontend works, how login and access tokens are
created, how data is stored, and how to run everything on your machine.
It is written in plain, formal English for easy reading.

---

## 1. What This Project Does

Driftwatch is described as **"Dependabot for every API you depend on."**

Tools like Dependabot watch your `package.json` and alert you when a
library version changes. But many companies (Stripe, Twilio, and others)
can change how their API behaves **without** any version change and
**without** touching your `package.json`. Nothing in your normal tooling
notices this. Driftwatch is built to catch exactly this gap.

In simple steps, the project does this:

1. It watches a vendor's changelog (a text file on the internet).
2. When that changelog changes, it asks Google's Gemini AI model to read
   the change and decide: is this a breaking change? How serious is it?
   Which code symbols (function names, fields, endpoints) does it affect?
3. It looks inside a connected GitHub repository to see whether that
   repository actually uses any of the affected symbols.
4. If the repository does **not** use the affected code, Driftwatch stops.
   No pull request is created and no noise is generated for the user.
5. If the repository **does** use the affected code, Driftwatch asks
   Gemini to rewrite the affected files so they work with the new API
   behavior.
6. It checks that the rewritten code is syntactically valid.
7. It opens a **draft** pull request on GitHub with the fix. It never
   merges anything automatically — a human must always review and merge.

---

## 2. Technology Used

| Purpose | Technology |
|---|---|
| Web framework (frontend + backend, both in one project) | Next.js 16 (App Router), JavaScript |
| Styling | Tailwind CSS v4 |
| AI model for reading changelogs and writing code fixes | Google Gemini (`@google/generative-ai` package, model `gemini-flash-latest`) |
| Talking to GitHub (reading repos, opening pull requests) | `@octokit/rest` and direct `fetch` calls to the GitHub REST API |
| Checking that AI-generated code is valid | `@babel/parser` |
| Data storage | A single JSON file on disk, plus an in-memory copy for speed (explained in Section 6) |
| Icons | `lucide-react` |

**Important point:** Next.js is a full-stack framework. There is **no
separate backend server**. The same project that shows you the web pages
also contains the backend logic (called "API routes"), and they run
together as a single process. Running one command starts both the
frontend and the backend at the same time.

---

## 3. Project Folder Structure

```
app/
  layout.js                  Root HTML layout, loads fonts and global CSS
  (marketing)/                Route group for the public landing page
    layout.js                 Wraps marketing pages with Header/Footer
    page.js                   Landing page (marketing content)
    pricing/page.js            Pricing page

  dashboard/
    page.js                    Main dashboard screen (client-side React)
    RepoRail.js                 Left column: list of connected repos
    DriftRail.js                 Middle column: the timeline of vendor changes
    IntegrationPanel.js          Right column: list of API call sites found
    ConnectRepoModal.js          Popup to pick a new repo to connect

  api/                         Backend logic — see Section 7 for full detail
    auth/login, callback, me, logout      Login system
    repos, repos/connect, repos/disconnect Repo management
    scan/status                            Scanning progress
    integrations                           Usage index for one repo
    check                                   Runs the full detection pipeline
    changes                                 List of detected vendor changes
    prs                                     List of pull requests

lib/                          Shared backend logic, used by the api/ routes
  vendors.js                   List of vendors Driftwatch watches (Stripe, Twilio)
  scanner.js                   Reads a GitHub repo's files and finds API usage
  detect.js                    Talks to Gemini to classify a changelog change
  patch.js                     Talks to Gemini to rewrite files, then opens a PR
  gh.js                        Shared helper for calling the GitHub API
  store.js                     Saves and loads all application data

scripts/
  test-scan.js                 Command-line test for the scanner only
  test-check.js                Command-line test for the full pipeline

.env.local                    Secret configuration values (see Section 4)
```

---

## 4. How to Run the Project

### 4.1 Requirements

- Node.js installed on your computer.
- A GitHub account, and a GitHub OAuth App already registered (Client ID
  and Client Secret).
- A Google Gemini API key.

### 4.2 Install dependencies

Open a terminal in the project folder and run:

```
npm install
```

### 4.3 Environment variables

The project reads its secret settings from a file called `.env.local` in
the project root. This file already exists in your project and is not
committed to Git (it is listed in `.gitignore`). It must contain:

| Variable | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` | The ID of your GitHub OAuth App, used to start the login flow |
| `GITHUB_CLIENT_SECRET` | The secret paired with the Client ID, used to exchange a login code for an access token |
| `GITHUB_CALLBACK_URL` | The URL GitHub redirects back to after login (e.g. `http://localhost:3000/api/auth/callback`) |
| `GEMINI_API_KEY` | Your API key for Google's Gemini model |
| `VENDOR_SPEC_URL` | The web address of the changelog Driftwatch watches (currently pointed at a mock Stripe changelog) |
| `GITHUB_TOKEN` | A personal access token, only used by the two files in `scripts/` for manual testing from the terminal. The running website never reads this value. |

Since your `.env.local` file already has real values filled in, you do
not need to change anything to run the project locally — just make sure
the file stays private and is never shared or committed to Git.

### 4.4 Running the project (development mode)

This single command starts **both** the frontend pages and the backend
API routes together:

```
npm run dev
```

Then open your browser at:

```
http://localhost:3000
```

There is no separate step to "start the backend" — it is already running
as part of the same Next.js server.

### 4.5 Running the project (production-style)

```
npm run build
npm start
```

`build` compiles the project. `start` runs the compiled version. This is
closer to how the real deployment (on Vercel) behaves.

### 4.6 Running the standalone test scripts

Two scripts exist for testing backend logic directly from the terminal,
without opening the website:

```
node scripts/test-scan.js owner/repo
node --env-file=.env.local scripts/test-check.js
```

`test-scan.js` only checks that the scanner can read a public GitHub
repository and find API call sites. `test-check.js` runs the entire
pipeline (match, patch, and open a pull request) against a fixed demo
repository, using a hardcoded example of a vendor change instead of
reading a live changelog.

---

## 5. How Login Works (Step by Step, Including Access Token Creation)

Driftwatch does **not** use a username-and-password system. It uses
**GitHub OAuth**, which means the user logs in through GitHub itself, and
GitHub tells Driftwatch who the user is. This login logic is written by
hand in this project (no external login library is used).

Here is exactly what happens, in order:

**Step 1 — User clicks "Sign in with GitHub."**
This sends the browser to `GET /api/auth/login`
([app/api/auth/login/route.js](app/api/auth/login/route.js)).

**Step 2 — The server creates a random "state" value.**
This is a random ID used to prevent a security attack called CSRF (a
trick where a different website could try to complete a login on the
user's behalf). The server stores this random value in a short-lived
cookie named `gh_oauth_state`, and then redirects the browser to GitHub's
own login page, passing along:
- the app's Client ID,
- the callback URL,
- the requested permission scope (`repo read:user`, meaning: read the
  user's profile and read/write access to their repositories),
- the random state value.

**Step 3 — The user logs in and approves access on GitHub's website.**
This step happens entirely on GitHub's servers, not in this project.

**Step 4 — GitHub redirects back to the app.**
GitHub sends the browser back to `GET /api/auth/callback`
([app/api/auth/callback/route.js](app/api/auth/callback/route.js)), and
includes two things in the web address: a one-time `code`, and the same
`state` value from Step 2.

**Step 5 — The server checks the state value matches.**
It compares the `state` value GitHub sent back against the value it
saved in the `gh_oauth_state` cookie in Step 2. If they do not match, the
login is rejected and the user is sent back to the home page with an
error message. This protects against a forged login attempt.

**Step 6 — The server exchanges the code for a real access token.**
The server makes a direct request to GitHub's token endpoint
(`https://github.com/login/oauth/access_token`), sending:
- `client_id`
- `client_secret`
- the `code` from Step 4
- the `redirect_uri`

GitHub verifies all of this and, if everything is correct, responds with
an **access token**. This is the actual credential that lets Driftwatch
call the GitHub API on the user's behalf. This exchange only works because
the `client_secret` is kept private on the server — it is never sent to
the browser.

**Step 7 — The access token is saved in a cookie.**
The server stores this access token in a cookie named `gh_token`. This
cookie is:
- `httpOnly` — meaning JavaScript running in the browser cannot read it
  (this protects it from being stolen by a cross-site scripting attack),
- `sameSite: lax` — a protection against the cookie being sent from
  other websites,
- valid for 30 days,
- marked `secure` in production, meaning it is only sent over HTTPS.

The temporary `gh_oauth_state` cookie is deleted, since it is no longer
needed. The browser is then redirected to `/dashboard`.

**Step 8 — Every later request reuses this cookie.**
From this point on, whenever the backend needs to call the GitHub API
(list repositories, read files, open a pull request), it reads the
access token straight out of the `gh_token` cookie. This logic lives in
one shared file, [lib/gh.js](lib/gh.js), function `getToken()`. If the
cookie is missing, the user is treated as signed out and a `401
Unauthorized` error is returned.

**How the frontend knows if someone is logged in:**
`GET /api/auth/me` ([app/api/auth/me/route.js](app/api/auth/me/route.js))
uses the saved token to ask GitHub "who is this user?" and returns their
username and avatar picture. If there is no valid token, it returns an
error, and the dashboard page sends the user back to the home page.

**Logging out:**
`POST /api/auth/logout` simply deletes the `gh_token` cookie. There is
no token to "cancel" on GitHub's side — deleting the cookie is enough,
since the app itself never stores the token anywhere except that cookie.

**Important security note:** there is no personal Google/GitHub secret
stored per-user in a database. The only thing the app remembers about a
signed-in user is what is inside that one browser cookie. If a user
clears cookies or the cookie expires after 30 days, they simply need to
log in again.

---

## 6. How Data Is Stored (the "Database")

This project does **not** use a real database engine (no PostgreSQL, no
MongoDB, no SQLite). Instead, it uses a very simple approach, built in
[lib/store.js](lib/store.js):

- All application data is kept as one JavaScript object in memory while
  the server is running (`memoryCache`).
- Every time the data changes, that whole object is also written out to
  a single JSON file, saved in the computer's temporary folder
  (`os.tmpdir()/driftwatch-store.json`).
- When the server restarts, it reads that JSON file back into memory
  once, and then keeps using the in-memory copy for speed.

This was a deliberate choice for the hackathon timeline. The two
functions `getState()` and `setState()` are the **only** way the rest of
the code touches this data, so replacing this file-based storage with a
real database (for example Postgres) later would not require changing
any other file.

The stored data is organized into these sections:

| Key | What it holds |
|---|---|
| `users` | GitHub user records (not heavily used, since login state lives in the cookie) |
| `repos` | Every repository the user has connected, keyed by `"owner/name"` |
| `integrations` | The list of API call sites found in each connected repository |
| `vendorChanges` | Every breaking/non-breaking change detected in any vendor's changelog. This list is **global** — shared across all users and repos, not tied to one person |
| `pullRequests` | A local record of every pull request Driftwatch has opened |
| `jobs` | Temporary progress state for an in-progress repository scan |
| `vendorSnapshots` | The last-seen text of each vendor's changelog, used to detect if it changed |

**Why `vendorChanges` is global:** reading a vendor's changelog and
asking Gemini to classify it costs one AI call. Rather than repeating
that same work for every connected repository, Driftwatch does it once
per vendor and then checks the result against every repository's own
usage index. This keeps AI usage low and cost-efficient.

**Important limitation:** because the data lives in a temporary file and
in memory, it will be lost if the temporary folder is cleared or if the
app is deployed across multiple serverless instances that do not share
the same file system. This is acceptable for a hackathon demo, but would
need to become a real database before real production use.

---

## 7. Backend API Endpoints (Full List)

All backend logic lives under `app/api/`. Each folder is one endpoint.
Below is every route, in the order a user would typically use them.

### Authentication

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/login` | GET | Starts GitHub OAuth login (redirects to GitHub) |
| `/api/auth/callback` | GET | Finishes login, saves the access token as a cookie, redirects to `/dashboard` |
| `/api/auth/me` | GET | Returns `{ login, avatarUrl }` for the signed-in user, or `401` if not signed in |
| `/api/auth/logout` | POST | Deletes the `gh_token` cookie |

### Repositories

| Route | Method | Purpose |
|---|---|---|
| `/api/repos` | GET | Lists the signed-in user's GitHub repositories, merged with local "connected" status |
| `/api/repos/connect` | POST `{ fullName }` | Starts connecting a repository: fetches its file list from GitHub and creates a background scan job. Returns a `jobId` |
| `/api/repos/disconnect` | POST `{ fullName }` | Removes a repository's connection and its stored usage index. Past vendor changes and pull requests are left untouched, since they are historical records |

### Scanning

| Route | Method | Purpose |
|---|---|---|
| `/api/scan/status` | GET `?jobId=` | Scans the next batch of 20 files for a given job and returns progress. The frontend calls this repeatedly (polling) until the status is `"done"` |
| `/api/integrations` | GET `?repoId=` | Returns the finished usage index (which vendor APIs are used, and at which file/line) for one repository |

### The Detection Pipeline

| Route | Method | Purpose |
|---|---|---|
| `/api/check` | POST `{ repoId }` | Runs the full pipeline for a repository: detect vendor changes → match against the repo's usage index → patch affected files → open a pull request. Explained fully in Section 8 |
| `/api/changes` | GET | Returns every vendor change ever detected, newest first |
| `/api/prs` | GET (optional `?repoId=`) | Without `repoId`: returns Driftwatch's own saved pull request records, enriched with live GitHub status (open/closed/merged). With `repoId`: asks GitHub directly for that repository's `driftwatch/*` pull requests |

### Why scanning is done in small batches

Reading every file in a large repository, one by one, could take longer
than a serverless function is allowed to run. To avoid this, scanning a
repository is split into steps of 20 files at a time
(`BATCH_SIZE` in [lib/scanner.js](lib/scanner.js)). The frontend calls
`/api/scan/status` again and again (every 900 milliseconds) until all
files have been scanned. Each call only does a small amount of work, so
no single request risks timing out.

---

## 8. The Detection Pipeline in Detail (`/api/check`)

This is the core feature of the project. When a user clicks **"Run check
now"**, the frontend sends `POST /api/check` with the selected
repository's ID. The backend then does the following, for every vendor
that has a changelog URL configured (currently only Stripe):

**Step 1 — Fetch the changelog.**
[lib/detect.js](lib/detect.js)'s `fetchVendorSpec()` downloads the raw
text of the vendor's changelog from its `specUrl`.

**Step 2 — Compare against the last-seen version.**
The new text is compared, line by line, against the version saved earlier
in `vendorSnapshots`. If nothing new was added, the pipeline stops for
this vendor with the outcome `"unchanged"` — **no AI call is made**.

**Step 3 — Classify the change with Gemini (1 AI call).**
If new lines were found, they are sent to Gemini with instructions to
answer, as a strict JSON object:
- `breaking` (true/false)
- `severity` (low/medium/high)
- `summary` (one plain sentence)
- `affectedSymbols` (a list of function/field/endpoint names)
- `migration` (what needs to change in the code)
- `sourceLine` (which exact changelog line this came from)
- `deadline` (a date, or none)

This result is saved as a new entry in `vendorChanges`, since it applies
to every repository that watches this vendor, not just the one being
checked right now.

**Step 4 — Skip if not breaking.**
If Gemini reports `breaking: false`, the outcome for this vendor is
`"non-breaking"` and the pipeline stops here for this repository.

**Step 5 — Skip if a pull request already exists for this exact change.**
Driftwatch checks its own saved `pullRequests` records to avoid opening
a duplicate pull request for a change it has already handled for this
repository.

**Step 6 — Match affected symbols against the repository's usage index.**
`matchAffectedCallSites()` in [lib/detect.js](lib/detect.js) compares
Gemini's `affectedSymbols` list against the exact file/line entries found
earlier while scanning the repository (Section 7). If there is no
overlap at all, the outcome is `"not-applicable"` and **nothing else
happens** — this is intentional. Driftwatch is designed to stay silent
when a change does not affect a particular repository's actual code.

**Step 7 — Patch the affected files with Gemini.**
If there is a match, up to 3 affected files ([lib/patch.js](lib/patch.js)'s
`MAX_PATCH_FILES`) are sent to Gemini, one at a time, with instructions
to rewrite only what is necessary to fix the breaking change (1 AI call
per file).

**Step 8 — Verify the rewritten code.**
Each rewritten file is checked using `@babel/parser`, to confirm the
result is still valid, parseable JavaScript/JSX/TypeScript. If a file
fails this check, Gemini is asked one more time to fix it, this time
including the exact parser error message (a maximum of 1 retry per
file).

**Step 9 — Open a draft pull request.**
Using Octokit (GitHub's official API client), the backend:
- creates a new branch from the repository's default branch,
- commits each patched file to that new branch,
- opens a pull request from that branch, marked as a **draft**,
- adds a `"driftwatch"` label (if the label does not already exist on
  the repository, this step is silently skipped, and the PR is still
  created).

The pull request description includes: which vendor changed, a summary,
severity, deadline, the exact changelog line it came from, the list of
affected file:line locations, and whether the code passed the syntax
check.

**Step 10 — Return every outcome.**
`/api/check` always returns a result for every vendor it checked — even
the ones with nothing interesting to report (`unchanged`,
`non-breaking`, `not-applicable`, `already-shipped`). This means the
dashboard is never left guessing; it always shows what happened.

### Staying inside the AI usage budget

A single call to `/api/check` is designed to use **5 Gemini calls or
fewer**, even in the worst case:
- 1 call to classify a changelog change,
- up to 3 calls to patch files (since a maximum of 3 files are ever
  patched in one run),
- up to 3 retry calls if a patch fails its syntax check — although in
  normal use this stays comfortably inside the 5-call target, since
  retries only happen on the rare file that fails parsing.

The code deliberately does not loop over every affected file with no
limit — the 3-file cap in [lib/patch.js](lib/patch.js) exists specifically
to protect this budget.

---

## 9. How the Repository Scanner Works

Before any check can run, a repository must be **connected** and
**scanned**, so Driftwatch knows what vendor APIs it actually uses.

`POST /api/repos/connect` ([app/api/repos/connect/route.js](app/api/repos/connect/route.js))
does the following:
1. Reads the repository's default branch from GitHub.
2. Asks GitHub for a full file tree of that branch.
3. Filters that tree down to real source files only — skipping
   `node_modules/`, `dist/`, `build/`, `.next/`, `test/` folders,
   minified files (`.min.js`), and non-code file types. Only
   `.js`, `.jsx`, `.ts`, and `.tsx` files are scanned.
4. Caps the file list at 200 files, so scanning a very large repository
   cannot run forever.
5. Saves a new scan "job" and returns a `jobId` immediately, without
   waiting for the scan to finish.

The frontend then repeatedly calls `GET /api/scan/status?jobId=...`.
Each call:
1. Fetches the content of the next 20 files (in parallel) directly from
   GitHub's blob API.
2. Runs a set of regular expressions (defined per vendor in
   [lib/vendors.js](lib/vendors.js)) against every line of every file,
   looking for patterns like `stripe.charges.create(` or
   `client.messages.create(`.
3. Records every match as a "call site": which vendor, which exact text
   matched, which file, which line number, and a small snippet of
   surrounding code.
4. Groups all call sites by vendor into the final "usage index" — this
   is what is shown in the right-hand panel of the dashboard, and it is
   exactly what Section 8's matching step compares AI results against.

Adding support for a brand-new vendor (beyond Stripe and Twilio) only
requires adding one new object to [lib/vendors.js](lib/vendors.js) — no
other file needs to change.

---

## 10. Frontend: How the Dashboard Works

The dashboard ([app/dashboard/page.js](app/dashboard/page.js)) is a
single React component ("client component," meaning it runs in the
browser, not on the server) that ties together all the pieces:

1. On load, it calls `/api/auth/me`. If that fails, the user is sent
   back to the home page.
2. Once confirmed signed in, it loads: the user's repositories
   (`/api/repos`), all detected vendor changes (`/api/changes`), and all
   pull requests (`/api/prs`), all at the same time.
3. It is split into three visual columns:
   - **RepoRail** (left) — the list of connected repositories, with a
     colored status dot (scanning / done), and a button to disconnect.
   - **DriftRail** (middle) — the main "Drift Rail" timeline showing
     every relevant vendor change as a node the user can expand to see
     details and any linked pull requests. This is the visual signature
     element of the product design.
   - **IntegrationPanel** (right) — the list of vendor API call sites
     found in whichever repository is currently selected, or a live
     progress bar while a scan is still running.
4. **Connecting a repository:** clicking "Connect a repo" opens
   `ConnectRepoModal`, listing repositories not yet connected. Picking
   one calls `/api/repos/connect`, then starts polling
   `/api/scan/status` every 900 milliseconds until scanning finishes.
   As soon as scanning is done, the dashboard automatically calls
   `/api/check` for that repository, so a newly connected repo can
   immediately surface a draft pull request without an extra click.
5. **Running a manual check:** the "Run check now" button calls
   `/api/check` for the currently selected repository and displays a
   line of text per vendor outcome underneath the button.
6. All network errors are caught and shown in a red banner at the top of
   the page, so failures are never silent.

### Landing page

The public marketing page (under the `(marketing)` route group,
[app/(marketing)/page.js](app/(marketing)/page.js)) explains the product
to visitors who are not signed in, and reuses the same "Drift Rail"
visual idea as a live example, rather than plain marketing text. If the
visitor is already signed in (their `gh_token` cookie exists), the
"Sign in" button becomes a "Go to dashboard" link instead.

---

## 11. Design System (Short Summary)

The visual style is intentionally built to feel like a technical
instrument panel rather than a typical marketing website:

- **Colors:** a small, fixed palette defined once in
  `app/globals.css` — ink (near-black text), paper/surface (light
  backgrounds), one signal color (blue-purple) for the main action
  button, a warning color (only for deadlines), and green/red used
  **only** to show additions/removals in diff-style content.
- **Fonts:** Bricolage Grotesque for headings, Instrument Sans for body
  text, and JetBrains Mono for anything code-like — file paths, line
  numbers, symbol names, branch names.
- **Animation:** the app deliberately has almost no animation. The one
  exception is a short one-time entrance animation when a brand-new
  vendor change node appears on the Drift Rail.

---

## 12. Known Simplifications (By Design, Not Bugs)

These choices were made on purpose for the hackathon timeline, and are
documented here so they are not mistaken for mistakes:

- **No real database.** Data lives in one JSON file plus memory (Section
  6). `getState()`/`setState()` is the single swap point for adding a
  real database later.
- **A single line of code can match twice.** The scanner's general
  patterns (like `stripe.charges.create(`) and its "bare word" patterns
  (like the word `charges` alone) run as independent passes, so the same
  line can be recorded twice. This is only cleaned up where it would
  otherwise show a duplicate line inside a pull request description.
- **Symbol matching is approximate, not exact.** Gemini's returned
  `affectedSymbols` text will not always match the scanner's captured
  text character-for-character, so matching is done by checking if one
  text contains the other, after trimming whitespace and trailing
  parentheses.
- **The model name differs from the original plan.** The plan called for
  `gemini-2.5-flash`, but that model returns an error for the API key in
  use. The project uses `gemini-flash-latest` instead, which is Google's
  alias for its current recommended flash-tier model — chosen so the
  project does not silently break again if a specific version number is
  later retired.

---

## 13. Quick Summary: End-to-End Flow

1. User visits the site and signs in with GitHub → an access token is
   created and stored in a secure browser cookie (Section 5).
2. User connects a repository → Driftwatch reads its files from GitHub
   and builds an index of every third-party API call it finds (Section
   9).
3. User clicks "Run check now" (or it runs automatically right after
   connecting) → Driftwatch fetches the vendor's changelog, asks Gemini
   whether anything breaking changed, and checks whether the connected
   repository actually uses the affected code (Section 8).
4. If nothing in the code is affected, Driftwatch stays silent for that
   repository — this is treated as a correct, useful outcome, not a
   failure.
5. If something is affected, Driftwatch asks Gemini to fix the affected
   files, checks that the fix is syntactically valid, and opens a draft
   pull request on GitHub for a human to review and merge.
