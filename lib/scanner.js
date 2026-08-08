// Builds an API usage index for a repo: every place a third-party API is
// used, mapped to file and line. Reads a repo purely through the GitHub
// REST API (no clone, no filesystem) so it works on serverless.

import { VENDORS } from "./vendors.js";

const GITHUB_API = "https://api.github.com";

const EXCLUDE_SEGMENTS = ["node_modules/", "dist/", "build/", ".next/", "test/"];
const CODE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
export const MAX_FILES = 200;
export const BATCH_SIZE = 20;

function isScannable(path) {
  if (path.endsWith(".min.js")) return false;
  if (!CODE_EXTENSIONS.some((ext) => path.endsWith(ext))) return false;
  if (EXCLUDE_SEGMENTS.some((seg) => path.includes(seg))) return false;
  return true;
}

function ghHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "driftwatch",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function ghFetch(path, token) {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: ghHeaders(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`GitHub API ${res.status} for ${path}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Step 1-2: list and filter the files worth scanning.
export async function buildFileIndex({ owner, repo, branch, token }) {
  const data = await ghFetch(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, token);
  const tree = data.tree || [];
  const files = tree
    .filter((item) => item.type === "blob")
    .filter((item) => isScannable(item.path))
    .slice(0, MAX_FILES)
    .map((item) => ({ path: item.path, sha: item.sha, size: item.size }));

  return {
    files,
    totalBlobsInRepo: tree.filter((item) => item.type === "blob").length,
    truncatedByGitHub: Boolean(data.truncated),
    cappedAt200: files.length >= MAX_FILES,
  };
}

// Step 3: fetch content for one file via the blobs API (base64 -> utf8).
async function fetchFileContent(file, token) {
  const data = await ghFetch(`/repos/${file.owner}/${file.repo}/git/blobs/${file.sha}`, token);
  if (data.encoding !== "base64") return null;
  return Buffer.from(data.content, "base64").toString("utf-8");
}

// Fetch a batch of files in parallel (default batch size 20).
export async function fetchFilesBatch(files, { owner, repo, token }) {
  return Promise.all(
    files.map(async (file) => {
      try {
        const content = await fetchFileContent({ ...file, owner, repo }, token);
        return { ...file, content, error: null };
      } catch (err) {
        return { ...file, content: null, error: err.message };
      }
    })
  );
}

// Step 4-5: run vendor regex patterns against one file's content, recording
// { vendor, symbol, file, line, snippet } for every match.
export function scanFileForCallSites(file, vendors = VENDORS) {
  if (!file.content) return [];
  const lines = file.content.split("\n");
  const results = [];

  for (const vendor of vendors) {
    const allPatterns = [...(vendor.patterns || []), ...(vendor.fieldPatterns || [])];
    for (const pattern of allPatterns) {
      const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
      const re = new RegExp(pattern.source, flags);
      lines.forEach((lineText, idx) => {
        re.lastIndex = 0;
        const match = re.exec(lineText);
        if (!match) return;
        const start = Math.max(0, idx - 1);
        const end = Math.min(lines.length, idx + 2);
        results.push({
          vendor: vendor.name,
          symbol: match[0].trim(),
          file: file.path,
          line: idx + 1,
          snippet: lines.slice(start, end).join("\n"),
        });
      });
    }
  }
  return results;
}

// Step 6: try to detect the SDK version for a vendor from package.json.
export function detectSdkVersion(vendor, packageJsonContent) {
  if (!packageJsonContent) return null;
  try {
    const pkg = JSON.parse(packageJsonContent);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const hints = vendor.packageHints || [vendor.name.toLowerCase()];
    const key = Object.keys(deps).find((dep) => hints.some((hint) => dep.toLowerCase().includes(hint)));
    return key ? deps[key] : null;
  } catch {
    return null;
  }
}

// Group flat call sites into per-vendor integration records.
export function buildIntegrations(callSites, packageJsonContent, vendors = VENDORS) {
  const byVendor = new Map();
  for (const site of callSites) {
    if (!byVendor.has(site.vendor)) byVendor.set(site.vendor, []);
    byVendor.get(site.vendor).push(site);
  }
  return Array.from(byVendor.entries()).map(([vendorName, sites]) => {
    const vendor = vendors.find((v) => v.name === vendorName);
    return {
      vendor: vendorName,
      sdkVersionGuess: vendor ? detectSdkVersion(vendor, packageJsonContent) : null,
      callSiteCount: sites.length,
      callSites: sites,
    };
  });
}

// Full, non-chunked scan (used for local verification / small repos).
// The HTTP API route drives the same primitives in 20-file batches instead,
// so a single request never runs long.
export async function scanRepo({ owner, repo, branch, token }) {
  const { files, cappedAt200, truncatedByGitHub, totalBlobsInRepo } = await buildFileIndex({
    owner,
    repo,
    branch,
    token,
  });

  let allCallSites = [];
  let packageJsonContent = null;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const withContent = await fetchFilesBatch(batch, { owner, repo, token });
    for (const file of withContent) {
      if (file.path === "package.json") packageJsonContent = file.content;
      allCallSites.push(...scanFileForCallSites(file));
    }
  }

  return {
    owner,
    repo,
    branch,
    filesScanned: files.length,
    totalScannableBlobsInRepo: totalBlobsInRepo,
    cappedAt200,
    truncatedByGitHub,
    integrations: buildIntegrations(allCallSites, packageJsonContent),
  };
}
