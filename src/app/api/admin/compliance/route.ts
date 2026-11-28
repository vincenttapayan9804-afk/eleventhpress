import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformSuperAdmin } from "@/lib/tenant-auth";
import { openConfirmNotes, parseCovers, parseDeviceChecks, policyState, deviceState, deviceFailing, registerSummary } from "@/lib/compliance";
import { POLICY_DRAFTS } from "@/lib/compliance-policy-drafts";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/compliance
 * The whole Compliance Register overview for the platform owner: every
 * policy (without its text, to keep the list light), every device, and the
 * summary counts. SUPER_ADMIN on the platform site only.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePlatformSuperAdmin(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const now = new Date();
  const [policies, devices] = await Promise.all([
    db.compliancePolicy.findMany({ orderBy: [{ category: "asc" }, { title: "asc" }] }),
    db.complianceDevice.findMany({ orderBy: [{ retiredAt: "asc" }, { label: "asc" }] }),
  ]);

  const have = new Set(policies.map((p) => p.slug));
  return NextResponse.json({
    now: now.toISOString(),
    summary: registerSummary(policies, devices, now),
    policies: policies.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      category: p.category,
      status: p.status,
      version: p.version,
      reviewIntervalMonths: p.reviewIntervalMonths,
      isPublic: p.isPublic,
      covers: parseCovers(p.covers),
      adoptedAt: p.adoptedAt,
      lastReviewedAt: p.lastReviewedAt,
      nextReviewDue: p.nextReviewDue,
      state: policyState(p, now),
      openNotes: openConfirmNotes(p.body).length,
    })),
    devices: devices.map((d) => ({
      id: d.id,
      label: d.label,
      kind: d.kind,
      checks: parseDeviceChecks(d.checks),
      failing: deviceFailing(parseDeviceChecks(d.checks)),
      notes: d.notes,
      lastCheckedAt: d.lastCheckedAt,
      nextCheckDue: d.nextCheckDue,
      retiredAt: d.retiredAt,
      state: deviceState(d, now),
    })),
    draftsAvailable: POLICY_DRAFTS.filter((d) => !have.has(d.slug)).length,
  });
}
