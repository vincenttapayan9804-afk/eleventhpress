import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformSuperAdmin } from "@/lib/tenant-auth";
import { parseBody } from "@/lib/validate";
import { POLICY_CATEGORIES, DEFAULT_REVIEW_MONTHS, isValidSlug, canAdopt, addMonths } from "@/lib/compliance";
import { POLICY_DRAFTS } from "@/lib/compliance-policy-drafts";
import { auditCompliance } from "@/lib/compliance-server";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("seed") }),
  z.object({ action: z.literal("adopt-ready") }),
  z.object({
    action: z.literal("create"),
    slug: z.string().trim().min(1).max(80),
    title: z.string().trim().min(3).max(200),
    category: z.enum(POLICY_CATEGORIES),
    body: z.string().max(60_000).default(""),
  }),
]);

/**
 * POST /api/admin/compliance/policies
 *  - { action: "seed" }: adds every starting draft that is not yet in the
 *    library. Never overwrites a policy the owner has already edited.
 *  - { action: "adopt-ready" }: the owner adopts, in one act, every draft that has no open
 *    [CONFIRM: …] note and is long enough. Drafts that still need an answer are skipped and
 *    listed. Each adoption is dated, recorded as a review, and written to the audit log.
 *  - { action: "create", slug, title, category, body }: adds a new draft.
 */
export async function POST(req: NextRequest) {
  const auth = await requirePlatformSuperAdmin(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseBody(req, Body);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  if (data.action === "seed") {
    const existing = new Set((await db.compliancePolicy.findMany({ select: { slug: true } })).map((p) => p.slug));
    const toAdd = POLICY_DRAFTS.filter((d) => !existing.has(d.slug));
    for (const d of toAdd) {
      await db.compliancePolicy.create({
        data: { slug: d.slug, title: d.title, category: d.category, body: d.body, covers: d.covers, reviewIntervalMonths: DEFAULT_REVIEW_MONTHS },
      });
    }
    await auditCompliance(auth.session.userId, "COMPLIANCE_DRAFTS_LOADED", "policies", { added: toAdd.map((d) => d.slug) });
    return NextResponse.json({ added: toAdd.length });
  }

  if (data.action === "adopt-ready") {
    const drafts = await db.compliancePolicy.findMany({ where: { status: "DRAFT" }, orderBy: { title: "asc" } });
    const on = new Date();
    const adopted: string[] = [];
    const skipped: { title: string; reason: string }[] = [];
    for (const p of drafts) {
      const check = canAdopt(p.body);
      if (!check.ok) {
        skipped.push({ title: p.title, reason: check.reason });
        continue;
      }
      await db.$transaction([
        db.compliancePolicy.update({
          where: { id: p.id },
          data: { status: "ADOPTED", adoptedAt: on, adoptedBy: auth.session.userId, lastReviewedAt: on, nextReviewDue: addMonths(on, p.reviewIntervalMonths) },
        }),
        db.complianceReview.create({ data: { policyId: p.id, reviewedAt: on, reviewedBy: auth.session.userId, outcome: "UPDATED", notes: `Adopted as version ${p.version} (bulk adoption).`, version: p.version } }),
      ]);
      await auditCompliance(auth.session.userId, "COMPLIANCE_POLICY_ADOPTED", p.id, { slug: p.slug, version: p.version, bulk: true });
      adopted.push(p.title);
    }
    return NextResponse.json({ adopted, skipped });
  }

  if (!isValidSlug(data.slug)) {
    return NextResponse.json({ error: "The short name may use lowercase letters, numbers and hyphens only." }, { status: 400 });
  }
  if (await db.compliancePolicy.findUnique({ where: { slug: data.slug } })) {
    return NextResponse.json({ error: "A policy with that short name already exists." }, { status: 409 });
  }
  const created = await db.compliancePolicy.create({
    data: { slug: data.slug, title: data.title, category: data.category, body: data.body },
  });
  await auditCompliance(auth.session.userId, "COMPLIANCE_POLICY_CREATED", created.id, { slug: data.slug });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
