import { NextResponse } from "next/server";

// Behind a proxy request.url is the container's internal origin, so prefer
// the public callback URL, then forwarded headers, then url.origin.
function getAppUrl(request, url) {
  if (process.env.GITHUB_CALLBACK_URL) {
    try {
      return new URL(process.env.GITHUB_CALLBACK_URL).origin;
    } catch {}
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${forwardedHost}`;
  }

  return url.origin;
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("gh_oauth_state")?.value;
  const appUrl = getAppUrl(request, url);

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/?error=${encodeURIComponent("GitHub did not return an authorization code.")}`
    );
  }
  if (!state || state !== cookieState) {
    return NextResponse.redirect(
      `${appUrl}/?error=${encodeURIComponent("Login state mismatch. Please try signing in again.")}`
    );
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_CALLBACK_URL,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || "GitHub did not return an access token.");
    }

    const res = NextResponse.redirect(`${appUrl}/dashboard`);
    res.cookies.set("gh_token", tokenData.access_token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === "production",
    });
    res.cookies.delete("gh_oauth_state");
    return res;
  } catch (err) {
    return NextResponse.redirect(`${appUrl}/?error=${encodeURIComponent(err.message)}`);
  }
}
