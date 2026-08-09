// Manual verification for a second vendor (Twilio), mirroring test-check.js:
// drive match -> patch -> ship end to end against the demo repo's default
// branch, using a hardcoded vendor change description rather than a live
// spec diff (see MULTI_VENDOR_TESTING.md, section 4).
//
// driftwatch-demo has no `dev` branch (only `main` and old driftwatch/*
// PR branches) — an earlier version of this script incorrectly targeted
// `dev`, confusing it with this project's own dev branch on GitHub.
//
// Assumes the repo's default branch already contains Twilio call sites
// (e.g. `client.messages.create(...)`) — if it doesn't, the match step
// will report 0 matches and stop, which is the correct "not applicable"
// behavior, not a bug in this script.
//
// Usage: node --env-file=.env.local scripts/test-check-twilio.js

import { scanRepo } from "../lib/scanner.js";
import { matchAffectedCallSites } from "../lib/detect.js";
import { patchAndShip } from "../lib/patch.js";

const owner = "nooraqib";
const repo = "driftwatch-demo";
const token = process.env.GITHUB_TOKEN;

const hardcodedVendorChange = {
  vendor: "Twilio",
  breaking: true,
  severity: "high",
  summary: "client.messages.create is deprecated in favor of client.messages.createV2",
  affectedSymbols: ["client.messages.create", "messages.create"],
  migration:
    "Replace client.messages.create({ to, from, body }) calls with client.messages.createV2({ to, from, body }). Keep the function's external behavior and exported names the same.",
  sourceLine: "- Removed support for `client.messages.create()`. Use `client.messages.createV2()` instead.",
  deadline: "2026-12-01",
  sourceUrl: process.env.TWILIO_SPEC_URL,
};

async function main() {
  const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "driftwatch" },
  });
  if (!branchRes.ok) {
    throw new Error(
      `Could not find branch '${branch}' on ${owner}/${repo}: ${branchRes.status}. Create it first, seeded with a Twilio call site.`
    );
  }

  console.error(`Scanning ${owner}/${repo}@${branch} for Twilio usage...`);
  const scan = await scanRepo({ owner, repo, branch, token });
  const totalCallSites = scan.integrations.reduce((n, i) => n + i.callSiteCount, 0);
  console.error(`Found ${totalCallSites} call site(s) across ${scan.integrations.length} vendor(s).`);

  const matched = matchAffectedCallSites(hardcodedVendorChange.affectedSymbols, scan.integrations);
  console.error(
    `Matched ${matched.length} call site(s) against the hardcoded change: ${matched
      .map((m) => `${m.file}:${m.line}`)
      .join(", ") || "none"}`
  );

  if (!matched.length) {
    console.error("No match — stopping here, no PR opened. (This is the intended 'not applicable' outcome.)");
    return;
  }

  console.error("Patching affected file(s) with Gemini and shipping a draft PR...");
  const pr = await patchAndShip({
    owner,
    repo,
    defaultBranch: branch,
    token,
    vendorChange: hardcodedVendorChange,
    matchedCallSites: matched,
  });

  console.log(JSON.stringify(pr, null, 2));
  console.error(`\nDone. Draft PR: ${pr.url}`);
}

main().catch((err) => {
  console.error("Check failed:", err.message);
  process.exit(1);
});
