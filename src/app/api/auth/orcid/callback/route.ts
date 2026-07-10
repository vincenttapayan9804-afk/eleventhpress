import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signToken, hashPassword } from "@/lib/auth";
import crypto from "crypto";

/**
 * GET /api/auth/orcid/callback
 * OAuth 2.0 callback. Exchanges the authorization code for an ORCID access
 * token, fetches the user's ORCID record (name, affiliations, works), and
 * either links to an existing user or creates a new one.
 *
 * In simulated mode (no ORCID_CLIENT_ID), creates/links a demo ORCID user.
 */

const ORCID_TOKEN_URL = "https://orcid.org/oauth/token";
const ORCID_SANDBOX_TOKEN_URL = "https://sandbox.orcid.org/oauth/token";
const ORCID_API_BASE = "https://pub.orcid.org/v3.0";
const ORCID_SANDBOX_API_BASE = "https://api.sandbox.orcid.org/v3.0";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const simulated = searchParams.get("simulated");

  const cookieState = req.cookies.get("orcid_oauth_state")?.value;
  if (state && cookieState && state !== cookieState) {
    return NextResponse.redirect(new URL("/?error=orcid_state_mismatch", req.url));
  }

  const clientId = process.env.ORCID_CLIENT_ID;
  const clientSecret = process.env.ORCID_CLIENT_SECRET;
  const isSandbox = process.env.ORCID_ENV !== "production";

  // --- SIMULATED MODE: create/link a demo ORCID user ---
  if (simulated === "1" || !clientId || !clientSecret) {
    return simulatedMode(req);
  }

  // --- REAL ORCID OAUTH ---
  const redirectUri = `${new URL(req.url).origin}/api/auth/orcid/callback`;
  const tokenUrl = isSandbox ? ORCID_SANDBOX_TOKEN_URL : ORCID_TOKEN_URL;

  try {
    // Exchange code for access token
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return NextResponse.redirect(new URL(`/?error=orcid_token_failed&detail=${encodeURIComponent(errText.slice(0, 200))}`, req.url));
    }

    const tokenData = await tokenRes.json();
    const orcidId: string = tokenData.orcid;
    const accessToken: string = tokenData.access_token;
    const refreshToken: string = tokenData.refresh_token;
    const expiresIn: number = tokenData.expires_in;

    // Fetch the user's public record (name)
    const apiBase = isSandbox ? ORCID_SANDBOX_API_BASE : ORCID_API_BASE;
    const recordRes = await fetch(`${apiBase}/${orcidId}/person`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    const record = await recordRes.json();
    const fullName =
      record?.name?.["given-names"]?.value && record?.name?.["family-name"]?.value
        ? `${record.name["given-names"].value} ${record.name["family-name"].value}`
        : `ORCID User ${orcidId.slice(-4)}`;

    // Fetch employment (affiliations)
    let affiliation: string | null = null;
    try {
      const empRes = await fetch(`${apiBase}/${orcidId}/employments`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      const empData = await empRes.json();
      const empSummary = empData?.["affiliation-group"]?.[0]?.summaries?.[0]?.["employment-summary"];
      if (empSummary) {
        affiliation = empSummary.organization?.name || null;
      }
    } catch {}

    // Find or create user
    let user = await db.user.findFirst({
      where: {
        OR: [{ orcid: orcidId }, { email: `${orcidId}@orcid.org` }],
      },
    });

    if (!user) {
      // Create new user with ORCID
      user = await db.user.create({
        data: {
          email: `${orcidId}@orcid.org`,
          passwordHash: hashPassword(crypto.randomUUID()),
          fullName,
          orcid: orcidId,
          affiliation,
          role: "AUTHOR",
          orcidAccessToken: accessToken,
          orcidRefreshToken: refreshToken,
          orcidTokenExpiry: new Date(Date.now() + expiresIn * 1000),
          orcidLastSync: new Date(),
        },
      });
    } else {
      // Link ORCID to existing user
      user = await db.user.update({
        where: { id: user.id },
        data: {
          orcid: orcidId,
          fullName: fullName || user.fullName,
          affiliation: affiliation || user.affiliation,
          orcidAccessToken: accessToken,
          orcidRefreshToken: refreshToken,
          orcidTokenExpiry: new Date(Date.now() + expiresIn * 1000),
          orcidLastSync: new Date(),
        },
      });
    }

    const epipToken = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    // Redirect to front-end with token in query (client stores it)
    const redirectUrl = new URL("/", req.url);
    redirectUrl.searchParams.set("orcid_token", epipToken);
    redirectUrl.searchParams.set("orcid_id", orcidId);
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete("orcid_oauth_state");
    return res;
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/?error=orcid_exception&detail=${encodeURIComponent(e.message)}`, req.url));
  }
}

/**
 * Simulated ORCID flow — creates a demo user with a fake ORCID iD so the
 * full UI (profile auto-population, ORCID badge, auto-update on publish)
 * works without real ORCID credentials.
 */
async function simulatedMode(req: NextRequest) {
  const fakeOrcid = `0000-0002-${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`;
  const fullName = "Dr. Oriana Cicero";
  const affiliation = "Simulated ORCID User — University of Edinburgh";

  let user = await db.user.findFirst({ where: { orcid: fakeOrcid } });
  if (!user) {
    user = await db.user.create({
      data: {
        email: `${fakeOrcid}@orcid.org`,
        passwordHash: hashPassword("orcid"),
        fullName,
        orcid: fakeOrcid,
        affiliation,
        role: "AUTHOR",
        orcidAccessToken: `sim_access_${Date.now()}`,
        orcidRefreshToken: `sim_refresh_${Date.now()}`,
        orcidTokenExpiry: new Date(Date.now() + 20 * 365 * 24 * 60 * 60 * 1000),
        orcidLastSync: new Date(),
        bio: "Auto-populated from ORCID public record. Employment: University of Edinburgh (2021–present). Education: PhD, University of Cambridge (2018).",
        expertise: "machine learning, computational biology",
        country: "United Kingdom",
      },
    });
  }

  const epipToken = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  });

  const redirectUrl = new URL("/", req.url);
  redirectUrl.searchParams.set("orcid_token", epipToken);
  redirectUrl.searchParams.set("orcid_id", fakeOrcid);
  redirectUrl.searchParams.set("orcid_simulated", "1");
  const res = NextResponse.redirect(redirectUrl);
  res.cookies.delete("orcid_oauth_state");
  return res;
}
