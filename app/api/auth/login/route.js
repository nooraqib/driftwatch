import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_CALLBACK_URL;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "GitHub OAuth is not configured on the server." }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo read:user",
    state,
  });

  const res = NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  res.cookies.set("gh_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
