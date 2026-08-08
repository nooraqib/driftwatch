// Manual M2 verification: drive detect(match)->patch->ship end to end
// against the real driftwatch-demo repo, using a hardcoded vendor change
// description (per the build order — live spec diffing is M5).
//
// Usage: node scripts/test-check.js

import { scanRepo } from "../lib/scanner.js";
import { matchAffectedCallSites } from "../lib/detect.js";
import { patchAndShip } from "../lib/patch.js";

const owner = "nooraqib";
const repo = "driftwatch-demo";
const token = process.env.GITHUB_TOKEN;

const hardcodedVendorChange = {
  vendor: "Stripe",
  breaking: true,
  severity: "high",
  summary: "stripe.charges.create is deprecated in favor of stripe.paymentIntents.create",
  affectedSymbols: ["stripe.charges.create", "charges.create"],
  migration:
    'Replace stripe.charges.create({ amount, currency, customer }) calls with stripe.paymentIntents.create({ amount, currency, customer, confirm: true, payment_method_types: ["card"] }). Keep the function\'s external behavior and exported names the same.',
  sourceLine: "- Removed support for `stripe.charges.create()`. Use `stripe.paymentIntents.create()` instead.",
  deadline: "2026-11-01",
  sourceUrl: process.env.VENDOR_SPEC_URL,
};

async function main() {
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "driftwatch" },
  });
  if (!repoRes.ok) throw new Error(`Could not fetch repo metadata: ${repoRes.status}`);
  const repoInfo = await repoRes.json();
  const branch = repoInfo.default_branch;

  console.error(`Scanning ${owner}/${repo}@${branch} for Stripe usage...`);
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
