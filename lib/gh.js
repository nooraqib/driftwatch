// Shared GitHub API helper. Reads the signed-in user's token from the
// httpOnly cookie set by /api/auth/callback and calls the GitHub REST API
// with the right headers, throwing readable errors on 401/403/404.
//
// All GitHub writes in this app go through this (or lib/patch.js's Octokit
// client, constructed with the same token) — never a personal access token.

import { cookies } from "next/headers";

const GITHUB_API = "https://api.github.com";

export class GhError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GhError";
    this.status = status;
  }
}

export async function getToken() {
  const store = await cookies();
  const token = store.get("gh_token")?.value;
  if (!token) {
    throw new GhError("Not signed in. Sign in with GitHub to continue.", 401);
  }
  return token;
}

export async function ghFetch(path, { token, method = "GET", body } = {}) {
  const authToken = token || (await getToken());
  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${authToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "driftwatch",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const messages = {
      401: "GitHub rejected the token. Sign in again.",
      403: "GitHub blocked this request (rate limit or missing permission).",
      404: "GitHub could not find that repo or resource.",
    };
    throw new GhError(messages[res.status] || `GitHub API error ${res.status}: ${text.slice(0, 200)}`, res.status);
  }

  if (res.status === 204) return null;
  return res.json();
}
