import { NextResponse } from "next/server";
import { setState } from "@/lib/store";

// Removes a repo from Driftwatch's local records. Vendor changes and past
// pull requests are global/historical and are left untouched — only this
// repo's connection and usage index are cleared.
export async function POST(request) {
  const { fullName } = await request.json();
  if (!fullName) {
    return NextResponse.json({ error: "fullName is required." }, { status: 400 });
  }

  setState((state) => {
    const repos = { ...state.repos };
    const integrations = { ...state.integrations };
    delete repos[fullName];
    delete integrations[fullName];
    return { ...state, repos, integrations };
  });

  return NextResponse.json({ ok: true });
}
