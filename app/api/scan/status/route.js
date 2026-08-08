import { NextResponse } from "next/server";
import { getToken, GhError } from "@/lib/gh";
import { getState, setState } from "@/lib/store";
import { fetchFilesBatch, scanFileForCallSites, buildIntegrations, BATCH_SIZE } from "@/lib/scanner";

// Scans the next batch of 20 files per call, so no single request runs long.
export async function GET(request) {
  try {
    const jobId = new URL(request.url).searchParams.get("jobId");
    if (!jobId) return NextResponse.json({ error: "jobId is required." }, { status: 400 });

    const state = getState();
    const job = state.jobs[jobId];
    if (!job) return NextResponse.json({ error: "Scan job not found." }, { status: 404 });

    if (job.status === "done") {
      return NextResponse.json({
        status: "done",
        progress: 100,
        filesScanned: job.files.length,
        total: job.files.length,
        integrations: state.integrations[job.repoId] || [],
      });
    }

    const token = await getToken();
    const batch = job.files.slice(job.nextIndex, job.nextIndex + BATCH_SIZE);
    const withContent = await fetchFilesBatch(batch, { owner: job.owner, repo: job.repo, token });

    let packageJsonContent = job.packageJsonContent;
    const newCallSites = [];
    for (const file of withContent) {
      if (file.path === "package.json") packageJsonContent = file.content;
      newCallSites.push(...scanFileForCallSites(file));
    }

    const nextIndex = job.nextIndex + batch.length;
    const allCallSites = [...job.callSites, ...newCallSites];
    const done = nextIndex >= job.files.length;
    const integrations = buildIntegrations(allCallSites, packageJsonContent);

    setState((s) => ({
      ...s,
      jobs: {
        ...s.jobs,
        [jobId]: { ...job, nextIndex, callSites: allCallSites, packageJsonContent, status: done ? "done" : "scanning" },
      },
      integrations: { ...s.integrations, [job.repoId]: integrations },
      repos: {
        ...s.repos,
        [job.repoId]: { ...s.repos[job.repoId], scanStatus: done ? "done" : "scanning" },
      },
    }));

    return NextResponse.json({
      status: done ? "done" : "scanning",
      progress: Math.round((nextIndex / (job.files.length || 1)) * 100),
      filesScanned: nextIndex,
      total: job.files.length,
      integrations,
    });
  } catch (err) {
    const status = err instanceof GhError ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
