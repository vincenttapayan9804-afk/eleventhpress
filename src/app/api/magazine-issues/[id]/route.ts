import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { getSessionFromHeaders, requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";
import { checkAndRecordMeterAccess, hasActiveSubscription, teaserHtml, READER_KEY_COOKIE } from "@/lib/paywall-meter";
import { COOKIE_CONSENT_COOKIE_NAME } from "@/lib/cookie-consent";

/**
 * GET /api/magazine-issues/[id]
 * Public callers may only fetch a PUBLISHED issue; editorial staff can
 * fetch any status (management dashboard). Includes pieces in reader order.
 *
 * Paywall metering (src/lib/paywall-meter.ts) applies here, to this
 * magazine/media content line only — never to the scholarly Article
 * pipeline, which stays unconditionally free under its CC BY 4.0 license.
 * Editorial staff previewing/managing an issue are never metered.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = await db.magazineIssue.findUnique({
    where: { id },
    include: { magazine: true, pieces: { orderBy: { order: "asc" } } },
  });
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = getSessionFromHeaders(req.headers);
  const isPrivileged = !!session && PRIVILEGED_ROLES.includes(session.role);
  if (issue.status !== "PUBLISHED" && !isPrivileged) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const heroUrls = await Promise.all(
    issue.pieces.map(async (p) => (p.heroImageKey ? await presignGet(p.heroImageKey) : null))
  );

  let readerKey: string | null = null;
  let setReaderKeyCookie: string | null = null;
  let pieces = issue.pieces.map((p, i) => ({ ...p, heroImageUrl: heroUrls[i], metered: false as boolean }));

  if (!isPrivileged) {
    // A signed-in reader's identity rides their existing (strictly
    // necessary) session cookie, so metering always applies to them — no
    // new cookie is being set. An anonymous reader only gets the
    // reader_key tracking cookie, and is only metered at all, once they've
    // accepted it via the cookie consent banner (src/components/
    // cookie-consent-banner.tsx). Declining or not yet deciding means
    // anonymous magazine reading stays unmetered — there's nothing to
    // count without a stable identifier, and this never sets a cookie
    // without consent.
    if (session) {
      readerKey = `user:${session.userId}`;
    } else if (req.cookies.get(COOKIE_CONSENT_COOKIE_NAME)?.value === "all") {
      readerKey = req.cookies.get(READER_KEY_COOKIE)?.value || null;
      if (!readerKey) {
        readerKey = `anon:${randomUUID()}`;
        setReaderKeyCookie = readerKey;
      }
    }

    if (readerKey) {
      const subscribed = await hasActiveSubscription(session?.userId ?? null);
      pieces = await Promise.all(
        issue.pieces.map(async (p, i) => {
          const meter = await checkAndRecordMeterAccess(readerKey!, p.id, subscribed);
          return meter.allowed
            ? { ...p, heroImageUrl: heroUrls[i], metered: false }
            : { ...p, heroImageUrl: heroUrls[i], metered: true, bodyHtml: teaserHtml(p.bodyHtml) };
        })
      );
    }
  }

  const res = NextResponse.json({
    issue: {
      ...issue,
      coverImageUrl: issue.coverImageKey ? await presignGet(issue.coverImageKey) : null,
      epubUrl: issue.epubKey ? await presignGet(issue.epubKey, `issue-${issue.volume}-${issue.issueNumber}.epub`) : null,
      pdfUrl: issue.pdfKey ? await presignGet(issue.pdfKey, `issue-${issue.volume}-${issue.issueNumber}.pdf`) : null,
      pieces,
    },
  });

  if (setReaderKeyCookie) {
    res.cookies.set(READER_KEY_COOKIE, setReaderKeyCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  return res;
}

/** PATCH /api/magazine-issues/[id] { title?, theme?, coverImageKey?, volume?, issueNumber?, year? } — editorial-only, DRAFT issues only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await db.magazineIssue.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT issues can be edited — an issue in production or already published is locked" }, { status: 400 });
  }

  const body = (await req.json()) as {
    title?: string;
    theme?: string;
    coverImageKey?: string;
    volume?: number;
    issueNumber?: number;
    year?: number;
  };

  const issue = await db.magazineIssue.update({
    where: { id },
    data: {
      title: body.title ?? existing.title,
      theme: body.theme ?? existing.theme,
      coverImageKey: body.coverImageKey ?? existing.coverImageKey,
      volume: body.volume ?? existing.volume,
      issueNumber: body.issueNumber ?? existing.issueNumber,
      year: body.year ?? existing.year,
    },
  });

  return NextResponse.json({ issue });
}
