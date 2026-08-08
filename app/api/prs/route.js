import { NextResponse } from "next/server";
import { ghFetch, GhError } from "@/lib/gh";
import { getState } from "@/lib/store";

// With ?repoId=, lists driftwatch/* PRs live from GitHub for that repo.
// Without it, returns the locally cached PR records across all repos.
export async function GET(request) {
  try {
    const repoId = new URL(request.url).searchParams.get("repoId");
    if (!repoId) {
      const state = getState();
      return NextResponse.json({ prs: Object.values(state.pullRequests) });
    }

    const [owner, repo] = repoId.split("/");
    const pulls = await ghFetch(`/repos/${owner}/${repo}/pulls?state=all&per_page=50`);
    const driftwatchPulls = pulls
      .filter((p) => p.head.ref.startsWith("driftwatch/"))
      .map((p) => ({
        number: p.number,
        url: p.html_url,
        title: p.title,
        state: p.state,
        draft: p.draft,
        branch: p.head.ref,
      }));

    return NextResponse.json({ prs: driftwatchPulls });
  } catch (err) {
    const status = err instanceof GhError ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
