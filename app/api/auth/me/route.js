import { NextResponse } from "next/server";
import { ghFetch, GhError } from "@/lib/gh";

export async function GET() {
  try {
    const user = await ghFetch("/user");
    return NextResponse.json({ login: user.login, avatarUrl: user.avatar_url });
  } catch (err) {
    const status = err instanceof GhError ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
