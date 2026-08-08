// Manual M1 verification: run the scanner against a hardcoded public repo
// and print the resulting API usage index. No server, no UI.
//
// Usage: node scripts/test-scan.js [owner/repo]
// Optional: set GITHUB_TOKEN in the env to avoid the 60 req/hr anonymous cap.

import { scanRepo } from "../lib/scanner.js";

const target = process.argv[2] || "stripe-samples/accept-a-payment";
const [owner, repo] = target.split("/");
const token = process.env.GITHUB_TOKEN;

async function main() {
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "driftwatch",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!repoRes.ok) {
    throw new Error(`Could not fetch repo metadata: ${repoRes.status} ${await repoRes.text()}`);
  }
  const repoInfo = await repoRes.json();
  const branch = repoInfo.default_branch;

  console.error(`Scanning ${owner}/${repo}@${branch} ...`);
  const result = await scanRepo({ owner, repo, branch, token });
  console.log(JSON.stringify(result, null, 2));

  const total = result.integrations.reduce((sum, i) => sum + i.callSiteCount, 0);
  console.error(
    `\nDone. Files scanned: ${result.filesScanned}. Vendors found: ${result.integrations
      .map((i) => `${i.vendor} (${i.callSiteCount})`)
      .join(", ") || "none"}. Total call sites: ${total}.`
  );
}

main().catch((err) => {
  console.error("Scan failed:", err.message);
  process.exit(1);
});
