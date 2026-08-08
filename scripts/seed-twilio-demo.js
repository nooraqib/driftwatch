// One-off seed script: commits a small file with a real Twilio call site
// directly to nooraqib/driftwatch-demo's main branch, so
// scripts/test-check-twilio.js has something real to match against.
// Mirrors the existing server/payments.js Stripe fixture already in that repo.
//
// Usage: node --env-file=.env.local scripts/seed-twilio-demo.js

const owner = "nooraqib";
const repo = "driftwatch-demo";
const path = "server/sms.js";
const branch = "main";
const token = process.env.GITHUB_TOKEN;

if (!token) throw new Error("GITHUB_TOKEN is not set.");

const fileContent = `const twilio = require("twilio");

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendOrderConfirmation(toNumber, orderId) {
  return client.messages.create({
    to: toNumber,
    from: process.env.TWILIO_FROM_NUMBER,
    body: \`Your order \${orderId} has been confirmed.\`,
  });
}

module.exports = { sendOrderConfirmation };
`;

async function main() {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "driftwatch",
  };

  const existingRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    { headers }
  );
  if (existingRes.ok) {
    console.error(`${path} already exists on ${branch} — nothing to do.`);
    return;
  }
  if (existingRes.status !== 404) {
    throw new Error(`Unexpected response checking for existing file: ${existingRes.status}`);
  }

  const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "test: seed a Twilio call site for driftwatch multi-vendor testing",
      content: Buffer.from(fileContent, "utf-8").toString("base64"),
      branch,
    }),
  });

  if (!putRes.ok) {
    throw new Error(`Could not create ${path}: ${putRes.status} ${await putRes.text()}`);
  }

  const result = await putRes.json();
  console.error(`Committed ${path} to ${owner}/${repo}@${branch}: ${result.commit.html_url}`);
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
