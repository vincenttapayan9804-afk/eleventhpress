/**
 * "Sign in with Google" (OpenID Connect). Off unless GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET are set; the sign-in screen only shows the button
 * when they are (GET /api/auth/providers). The redirect URI to register
 * with Google is <site>/api/auth/google/callback for each domain in use.
 */
export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}
