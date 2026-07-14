import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exchangeCodeForTokens, fetchFirstBlog, isBloggerLiveMode } from "@/lib/blogger";

/**
 * GET /api/auth/blogger/callback
 * OAuth 2.0 callback for the Blogger connect flow. Reads the CSRF state and
 * the initiating user's id back out of the httpOnly cookies set by
 * GET /api/auth/blogger, exchanges the code for tokens, fetches the
 * account's first blog, and stores the connection on that user.
 *
 * In simulated mode (no GOOGLE_CLIENT_ID), mints a clearly-labeled fake
 * connection instead — same convention as /api/auth/orcid/callback's
 * simulatedMode().
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const simulated = searchParams.get("simulated");

  const cookieState = req.cookies.get("blogger_oauth_state")?.value;
  const userId = req.cookies.get("blogger_oauth_user")?.value;

  if (!userId) {
    return NextResponse.redirect(new URL("/?error=blogger_session_expired", req.url));
  }
  if (state && cookieState && state !== cookieState) {
    return NextResponse.redirect(new URL("/?error=blogger_state_mismatch", req.url));
  }

  // --- SIMULATED MODE ---
  if (simulated === "1" || !isBloggerLiveMode()) {
    const user = await db.user.update({
      where: { id: userId },
      data: {
        bloggerAccessToken: `sim_access_${Date.now()}`,
        bloggerRefreshToken: `sim_refresh_${Date.now()}`,
        bloggerTokenExpiry: new Date(Date.now() + 20 * 365 * 24 * 60 * 60 * 1000),
        bloggerBlogId: `sim_blog_${userId}`,
        bloggerBlogUrl: `https://simulated-blogger.example/${userId}`,
        bloggerConnectedAt: new Date(),
      },
    });
    const res = NextResponse.redirect(new URL(`/?blogger_connected=1&blogger_simulated=1`, req.url));
    res.cookies.delete("blogger_oauth_state");
    res.cookies.delete("blogger_oauth_user");
    return res;
  }

  // --- REAL GOOGLE OAUTH ---
  if (!code) {
    return NextResponse.redirect(new URL("/?error=blogger_missing_code", req.url));
  }
  const redirectUri = `${new URL(req.url).origin}/api/auth/blogger/callback`;

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const blog = await fetchFirstBlog(tokens.accessToken);
    if (!blog) {
      return NextResponse.redirect(new URL("/?error=blogger_no_blog_found", req.url));
    }

    await db.user.update({
      where: { id: userId },
      data: {
        bloggerAccessToken: tokens.accessToken,
        bloggerRefreshToken: tokens.refreshToken,
        bloggerTokenExpiry: tokens.expiresAt,
        bloggerBlogId: blog.id,
        bloggerBlogUrl: blog.url,
        bloggerConnectedAt: new Date(),
      },
    });

    const res = NextResponse.redirect(new URL("/?blogger_connected=1", req.url));
    res.cookies.delete("blogger_oauth_state");
    res.cookies.delete("blogger_oauth_user");
    return res;
  } catch (e: any) {
    const res = NextResponse.redirect(new URL(`/?error=blogger_exception&detail=${encodeURIComponent(e.message.slice(0, 200))}`, req.url));
    res.cookies.delete("blogger_oauth_state");
    res.cookies.delete("blogger_oauth_user");
    return res;
  }
}
