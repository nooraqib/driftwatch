// Patch, verify, ship: for each affected file (max 3, to stay inside the
// Gemini budget), rewrite it with Gemini, verify the result parses, retry
// once on failure, then commit everything to a new branch and open a draft
// PR via Octokit.

import { Octokit } from "@octokit/rest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as babelParser from "@babel/parser";

const MODEL_NAME = "gemini-flash-latest";
export const MAX_PATCH_FILES = 3;

const PATCH_SYSTEM_INSTRUCTION = `You are Driftwatch's patch generator. You are given the full current content of one source file, a description of a breaking API change, and the list of affected symbols. Rewrite ONLY what is necessary to migrate the file to the new API contract.

Rules:
- Return the COMPLETE corrected file content, and nothing else.
- No explanation, no markdown code fences, no placeholder comments.
- Change nothing unrelated to the migration.
- Preserve existing formatting style as closely as possible.`;

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Add it to .env.local.");
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: MODEL_NAME });
}

function stripFences(text) {
  return text
    .trim()
    .replace(/^```[\w]*\n?/, "")
    .replace(/```$/, "")
    .trim();
}

// stripFences trims, which also eats the file's final newline — committing
// that makes every file in the pull request show "\ No newline at end of
// file". Put it back when the original file had one.
function matchTrailingNewline(patched, originalContent) {
  if (!originalContent.endsWith("\n") || patched.endsWith("\n")) return patched;
  return `${patched}\n`;
}

function verifySyntax(code) {
  try {
    babelParser.parse(code, { sourceType: "unambiguous", plugins: ["jsx", "typescript"] });
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// One Gemini call: rewrite one file. Called a second time (with the parser
// error appended) if the first attempt fails to verify.
async function generatePatch({ filePath, originalContent, migration, affectedSymbols, previousError }) {
  const model = getModel();
  const promptParts = [
    `File: ${filePath}`,
    `Migration required: ${migration}`,
    `Affected symbols: ${(affectedSymbols || []).join(", ")}`,
    previousError ? `Your previous attempt failed to parse. Fix this error: ${previousError}` : null,
    `--- CURRENT FILE CONTENT ---`,
    originalContent,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: promptParts }] }],
    systemInstruction: PATCH_SYSTEM_INSTRUCTION,
  });
  return stripFences(result.response.text());
}

// Fetch, patch, and verify one file. One Gemini call, plus one retry call
// only if the first result fails to parse.
export async function patchFile({ octokit, owner, repo, filePath, migration, affectedSymbols }) {
  const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
  const originalContent = Buffer.from(data.content, "base64").toString("utf-8");

  let patchedContent = await generatePatch({ filePath, originalContent, migration, affectedSymbols });
  let verify = verifySyntax(patchedContent);

  if (!verify.ok) {
    patchedContent = await generatePatch({
      filePath,
      originalContent,
      migration,
      affectedSymbols,
      previousError: verify.error,
    });
    verify = verifySyntax(patchedContent);
  }

  return {
    filePath,
    originalContent,
    patchedContent: matchTrailingNewline(patchedContent, originalContent),
    verifyPassed: verify.ok,
    verifyError: verify.error,
  };
}

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function buildPrBody(vendorChange, callSites, patchedFiles, allVerified) {
  const seen = new Set();
  const uniqueCallSites = callSites.filter((site) => {
    const key = `${site.file}:${site.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const callSitesList = uniqueCallSites.map((site) => `- \`${site.file}:${site.line}\` — \`${site.symbol}\``).join("\n");
  return `## Driftwatch detected a breaking change in ${vendorChange.vendor}

**${vendorChange.summary}**

Severity: ${vendorChange.severity} · Deadline: ${vendorChange.deadline || "none given"}

### What changed
${vendorChange.migration}

### Source
> ${vendorChange.sourceLine}
${vendorChange.sourceUrl || ""}

### Affected call sites
${callSitesList}

### Verification
${allVerified ? "✅ Syntax check passed" : "⚠️ Could not verify — review carefully"}

---
Opened as a draft. Driftwatch never merges automatically.`;
}

// Ship: create branch, commit each patched file, open a draft PR.
export async function shipPullRequest({ octokit, owner, repo, defaultBranch, vendorChange, callSites, patchedFiles }) {
  const baseSlug = `driftwatch/${vendorChange.vendor.toLowerCase()}-${slugify(vendorChange.summary)}`;
  const { data: baseRef } = await octokit.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` });

  // A branch with this slug may already exist (e.g. the same change was
  // checked before). Fall back to a short, unique suffix instead of failing.
  let branchName = baseSlug;
  try {
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: baseRef.object.sha });
  } catch (err) {
    if (err.status !== 422) throw err;
    branchName = `${baseSlug}-${Date.now().toString(36)}`;
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: baseRef.object.sha });
  }

  for (const file of patchedFiles) {
    const { data: existing } = await octokit.repos.getContent({ owner, repo, path: file.filePath, ref: branchName });
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.filePath,
      message: `driftwatch: migrate ${file.filePath} for ${vendorChange.vendor} change`,
      content: Buffer.from(file.patchedContent, "utf-8").toString("base64"),
      sha: existing.sha,
      branch: branchName,
    });
  }

  const allVerified = patchedFiles.every((f) => f.verifyPassed);

  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: `Driftwatch: ${vendorChange.vendor} — ${vendorChange.summary}`,
    head: branchName,
    base: defaultBranch,
    body: buildPrBody(vendorChange, callSites, patchedFiles, allVerified),
    draft: true,
  });

  try {
    await octokit.issues.addLabels({ owner, repo, issue_number: pr.number, labels: ["driftwatch"] });
  } catch {
    // Label may not exist yet on this repo — non-fatal, PR is already open.
  }

  return {
    number: pr.number,
    url: pr.html_url,
    branchName,
    filesChanged: patchedFiles.map((f) => f.filePath),
    verifyPassed: allVerified,
  };
}

// Full patch+ship for one repo. matchedCallSites come from
// lib/detect.js#matchAffectedCallSites. Caller has already confirmed the
// match is non-empty.
export async function patchAndShip({ owner, repo, defaultBranch, token, vendorChange, matchedCallSites }) {
  const octokit = new Octokit({ auth: token });

  const uniqueFiles = [...new Set(matchedCallSites.map((site) => site.file))].slice(0, MAX_PATCH_FILES);

  const patchedFiles = [];
  for (const filePath of uniqueFiles) {
    const patched = await patchFile({
      octokit,
      owner,
      repo,
      filePath,
      migration: vendorChange.migration,
      affectedSymbols: vendorChange.affectedSymbols,
    });
    patchedFiles.push(patched);
  }

  return shipPullRequest({
    octokit,
    owner,
    repo,
    defaultBranch,
    vendorChange,
    callSites: matchedCallSites,
    patchedFiles,
  });
}
