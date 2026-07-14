/**
 * Blogger — Tier A article syndication (see src/lib/distribution.ts's module
 * doc for the tier rationale). Unlike Tier B/C, Blogger has a genuine public
 * API for third-party publishing with no partner-approval gate, so once an
 * author connects their Google account, POST /api/distribution for the
 * BLOGGER platform actually publishes the post and marks the row LIVE
 * immediately — no human click, no self-reported status.
 *
 * Falls back to a clearly-labeled simulated connect/publish flow when
 * GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET aren't configured, mirroring the
 * ORCID OAuth (src/app/api/auth/orcid) and payment-provider
 * (src/lib/payments/simulate.ts) simulation conventions already used
 * elsewhere in this codebase — the full connect -> publish -> live UI works
 * in a demo environment without real Google Cloud credentials, and nothing
 * actually leaves this server while simulated.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const BLOGGER_API_BASE = "https://www.googleapis.com/blogger/v3";
const BLOGGER_SCOPE = "https://www.googleapis.com/auth/blogger";

/** True once real Google OAuth credentials are configured. */
export function isBloggerLiveMode(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: BLOGGER_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface BloggerTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<BloggerTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}

export interface BloggerBlog {
  id: string;
  url: string;
}

/** Fetches the first blog on the connected account — this app publishes to a single blog per author, matching the "connect your blog once" mental model authors expect. */
export async function fetchFirstBlog(accessToken: string): Promise<BloggerBlog | null> {
  const res = await fetch(`${BLOGGER_API_BASE}/users/self/blogs`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const first = data.items?.[0];
  return first ? { id: first.id, url: first.url } : null;
}

export interface BloggerConnectedUser {
  bloggerAccessToken: string | null;
  bloggerRefreshToken: string | null;
  bloggerTokenExpiry: Date | null;
}

/**
 * Returns a valid access token, refreshing it first if it has expired (or is
 * within a minute of expiring). Persists a refreshed token via the supplied
 * callback so the DB write stays with the caller — this module stays free
 * of a direct `db` import, which keeps it easy to unit test.
 */
export async function getValidAccessToken(
  user: BloggerConnectedUser,
  onRefresh: (accessToken: string, expiresAt: Date) => Promise<void>
): Promise<string | null> {
  if (!user.bloggerAccessToken || !user.bloggerRefreshToken) return null;
  if (user.bloggerAccessToken.startsWith("sim_")) return user.bloggerAccessToken;

  const expiry = user.bloggerTokenExpiry;
  if (expiry && expiry.getTime() - Date.now() > 60_000) {
    return user.bloggerAccessToken;
  }
  const refreshed = await refreshAccessToken(user.bloggerRefreshToken);
  await onRefresh(refreshed.accessToken, refreshed.expiresAt);
  return refreshed.accessToken;
}

export interface BloggerPostInput {
  title: string;
  html: string;
}

export interface BloggerPostResult {
  url: string;
  id: string;
  simulated: boolean;
}

/**
 * Publishes a post to the connected blog. A `sim_`-prefixed access token
 * (minted only by the simulated connect flow) short-circuits to a fake,
 * clearly-labeled result — no network call is made — so the rest of the
 * pipeline (status LIVE, externalUrl link) behaves identically without real
 * credentials.
 */
export async function publishPost(accessToken: string, blogId: string, post: BloggerPostInput): Promise<BloggerPostResult> {
  if (accessToken.startsWith("sim_")) {
    return {
      url: `https://simulated-blogger.example/${blogId}/${encodeURIComponent(post.title.toLowerCase().replace(/\s+/g, "-")).slice(0, 60)}`,
      id: `sim_post_${Date.now()}`,
      simulated: true,
    };
  }
  const res = await fetch(`${BLOGGER_API_BASE}/blogs/${blogId}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: post.title, content: post.html }),
  });
  if (!res.ok) throw new Error(`Blogger publish failed: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return { url: data.url, id: data.id, simulated: false };
}
