import { NextResponse } from "next/server";
import { ghFetch, getToken, GhError } from "@/lib/gh";
import { setState } from "@/lib/store";
import { buildFileIndex } from "@/lib/scanner";

export async function POST(request) {
  try {
    const { fullName } = await request.json();
    if (!fullName || !fullName.includes("/")) {
      return NextResponse.json({ error: "fullName must be 'owner/repo'." }, { status: 400 });
    }
    const [owner, repo] = fullName.split("/");
    const token = await getToken();

    const repoInfo = await ghFetch(`/repos/${owner}/${repo}`, { token });
    const branch = repoInfo.default_branch;

    const { files, cappedAt200 } = await buildFileIndex({ owner, repo, branch, token });
    const jobId = crypto.randomUUID();

    setState((state) => ({
      ...state,
      repos: {
        ...state.repos,
        [fullName]: {
          id: fullName,
          fullName,
          defaultBranch: branch,
          connectedAt: state.repos[fullName]?.connectedAt || new Date().toISOString(),
          scanStatus: "scanning",
        },
      },
      jobs: {
        ...state.jobs,
        [jobId]: {
          id: jobId,
          repoId: fullName,
          owner,
          repo,
          branch,
          files,
          cappedAt200,
          nextIndex: 0,
          callSites: [],
          packageJsonContent: null,
          status: "scanning",
        },
      },
    }));

    return NextResponse.json({ jobId, total: files.length });
  } catch (err) {
    const status = err instanceof GhError ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
