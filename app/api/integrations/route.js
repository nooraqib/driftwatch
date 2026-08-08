import { NextResponse } from "next/server";
import { getState } from "@/lib/store";

export async function GET(request) {
  const repoId = new URL(request.url).searchParams.get("repoId");
  if (!repoId) return NextResponse.json({ error: "repoId is required." }, { status: 400 });
  const state = getState();
  return NextResponse.json({ integrations: state.integrations[repoId] || [] });
}
