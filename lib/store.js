// Single JSON file in /tmp + an in-memory cache. No database today.
// getState()/setState() is the whole interface so this can be swapped for
// Postgres later without touching callers.
//
// vendorChange records are GLOBAL, not per-user/per-repo: a vendor's
// changelog is read once and fanned out to every repo whose usage index
// contains the affected symbols. See lib/detect.js for the fan-out.

import fs from "fs";
import os from "os";
import path from "path";

const STORE_PATH = path.join(os.tmpdir(), "driftwatch-store.json");

let memoryCache = null;

function defaultState() {
  return {
    users: {}, // githubId -> { githubId, login, avatarUrl }
    repos: {}, // repoId ("owner/name") -> { id, fullName, defaultBranch, connectedAt, scanStatus }
    integrations: {}, // repoId -> [{ vendor, sdkVersionGuess, callSiteCount, callSites }]
    vendorChanges: [], // global, newest first
    pullRequests: {}, // id -> { id, repoId, changeId, number, url, title, filesChanged, status, verifyPassed }
    jobs: {}, // scan job id -> in-progress scan state
    vendorSnapshots: {}, // vendorName -> last-seen raw spec text
  };
}

function readFromDisk() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getState() {
  if (!memoryCache) {
    memoryCache = readFromDisk() || defaultState();
  }
  return memoryCache;
}

export function setState(updater) {
  const current = getState();
  const next = typeof updater === "function" ? updater(current) : { ...current, ...updater };
  memoryCache = next;
  fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
