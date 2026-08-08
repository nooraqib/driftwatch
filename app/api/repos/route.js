import { NextResponse } from "next/server";
import { ghFetch, GhError } from "@/lib/gh";
import { getState } from "@/lib/store";

export async function GET() {
  try {
    const repos = await ghFetch("/user/repos?sort=updated&per_page=50&affiliation=owner");
    const state = getState();
    const list = repos.map((r) => {
      const connected = state.repos[r.full_name];
      return {
        id: r.full_name,
        fullName: r.full_name,
        defaultBranch: r.default_branch,
        private: r.private,
        connected: Boolean(connected),
        scanStatus: connected?.scanStatus || null,
      };
    });
    return NextResponse.json({ repos: list });
  } catch (err) {
    const status = err instanceof GhError ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
