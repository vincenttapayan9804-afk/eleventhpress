import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformSuperAdmin } from "@/lib/tenant-auth";
import { parseBody } from "@/lib/validate";
import { POLICY_CATEGORIES, REVIEW_OUTCOMES, addMonths, canAdopt, openConfirmNotes, parseCovers, isQuestionId } from "@/lib/compliance";
import { auditCompliance } from "@/lib/compliance-server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requirePlatformSuperAdmin(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const p = await db.compliancePolicy.findUnique({ where: { id }, include: { reviews: { orderBy: { reviewedAt: "desc" }, take: 50 } } });
  if (!p) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  return NextResponse.json({ policy: { ...p, covers: parseCovers(p.covers), openNotes: openConfirmNotes(p.body) } });
}

const pastDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .transform((s) => new Date(s))
  .refine((d) => !Number.isNaN(d.getTime()) && d.getTime() <= Date.now() + 60_000, "The date cannot be in the future.");

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    title: z.string().trim().min(3).max(200).optional(),
    category: z.enum(POLICY_CATEGORIES).optional(),
    body: z.string().max(60_000).optional(),
    reviewIntervalMonths: z.number().int().min(1).max(36).optional(),
    isPublic: z.boolean().optional(),
    covers: z.array(z.string()).max(200).optional(),
  }),
  z.object({ action: z.literal("adopt"), adoptedOn: pastDate.optional() }),
  z.object({ action: z.literal("review"), outcome: z.enum(REVIEW_OUTCOMES), notes: z.string().trim().max(2000).optional(), reviewedOn: pastDate.optional() }),
  z.object({ action: z.literal("retire") }),
  z.object({ action: z.literal("reopen") }),
]);

/**
 * PATCH /api/admin/compliance/policies/[id]
 * The register never creates evidence on its own: adopting and reviewing are
 * the owner's own acts, each dated and written to the audit log.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requirePlatformSuperAdmin(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const parsed = await parseBody(req, Body);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const p = await db.compliancePolicy.findUnique({ where: { id } });
  if (!p) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  const uid = auth.session.userId;

  if (data.action === "save") {
    if (p.status === "RETIRED") return NextResponse.json({ error: "A retired policy cannot be edited. Reopen it first." }, { status: 409 });
    const update: Record<string, unknown> = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.category !== undefined) update.category = data.category;
    if (data.reviewIntervalMonths !== undefined) {
      update.reviewIntervalMonths = data.reviewIntervalMonths;
      if (p.status === "ADOPTED" && p.lastReviewedAt) update.nextReviewDue = addMonths(p.lastReviewedAt, data.reviewIntervalMonths);
    }
    if (data.isPublic !== undefined) update.isPublic = data.isPublic;
    if (data.covers !== undefined) {
      const bad = data.covers.filter((c) => !isQuestionId(c));
      if (bad.length) return NextResponse.json({ error: `Not a valid question ID: ${bad.slice(0, 3).join(", ")}` }, { status: 400 });
      update.covers = data.covers.join(" ");
    }
    if (data.body !== undefined && data.body !== p.body) {
      if (p.status === "ADOPTED") {
        // Changing the text of a policy already in force makes a new version,
        // and the new text must have no unresolved notes.
        const check = canAdopt(data.body);
        if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });
        update.version = p.version + 1;
      }
      update.body = data.body;
    }
    const saved = await db.compliancePolicy.update({ where: { id }, data: update });
    await auditCompliance(uid, "COMPLIANCE_POLICY_SAVED", id, { slug: p.slug, fields: Object.keys(update), version: saved.version });
    return NextResponse.json({ ok: true, version: saved.version });
  }

  if (data.action === "adopt") {
    if (p.status === "ADOPTED") return NextResponse.json({ error: "This policy is already adopted." }, { status: 409 });
    const check = canAdopt(p.body);
    if (!check.ok) return NextResponse.json({ error: check.reason, notes: check.notes }, { status: 400 });
    const on = data.adoptedOn ?? new Date();
    await db.$transaction([
      db.compliancePolicy.update({
        where: { id },
        data: { status: "ADOPTED", adoptedAt: on, adoptedBy: uid, lastReviewedAt: on, nextReviewDue: addMonths(on, p.reviewIntervalMonths) },
      }),
      db.complianceReview.create({ data: { policyId: id, reviewedAt: on, reviewedBy: uid, outcome: "UPDATED", notes: `Adopted as version ${p.version}.`, version: p.version } }),
    ]);
    await auditCompliance(uid, "COMPLIANCE_POLICY_ADOPTED", id, { slug: p.slug, version: p.version });
    return NextResponse.json({ ok: true });
  }

  if (data.action === "review") {
    if (p.status !== "ADOPTED") return NextResponse.json({ error: "Only an adopted policy can be reviewed." }, { status: 409 });
    const on = data.reviewedOn ?? new Date();
    await db.$transaction([
      db.complianceReview.create({ data: { policyId: id, reviewedAt: on, reviewedBy: uid, outcome: data.outcome, notes: data.notes || null, version: p.version } }),
      db.compliancePolicy.update({ where: { id }, data: { lastReviewedAt: on, nextReviewDue: addMonths(on, p.reviewIntervalMonths) } }),
    ]);
    await auditCompliance(uid, "COMPLIANCE_POLICY_REVIEWED", id, { slug: p.slug, outcome: data.outcome, version: p.version });
    return NextResponse.json({ ok: true });
  }

  if (data.action === "retire") {
    await db.compliancePolicy.update({ where: { id }, data: { status: "RETIRED", nextReviewDue: null } });
    await auditCompliance(uid, "COMPLIANCE_POLICY_RETIRED", id, { slug: p.slug });
    return NextResponse.json({ ok: true });
  }

  // reopen: a retired policy goes back to a draft that must be adopted again.
  if (p.status !== "RETIRED") return NextResponse.json({ error: "Only a retired policy can be reopened." }, { status: 409 });
  await db.compliancePolicy.update({ where: { id }, data: { status: "DRAFT", adoptedAt: null, adoptedBy: null, lastReviewedAt: null, nextReviewDue: null } });
  await auditCompliance(uid, "COMPLIANCE_POLICY_REOPENED", id, { slug: p.slug });
  return NextResponse.json({ ok: true });
}

/** DELETE: only a draft that has never been adopted can be removed. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requirePlatformSuperAdmin(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const p = await db.compliancePolicy.findUnique({ where: { id }, include: { _count: { select: { reviews: true } } } });
  if (!p) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  if (p.status !== "DRAFT" || p._count.reviews > 0) {
    return NextResponse.json({ error: "Only a draft that was never adopted can be deleted. Retire it instead, so the history is kept." }, { status: 409 });
  }
  await db.compliancePolicy.delete({ where: { id } });
  await auditCompliance(auth.session.userId, "COMPLIANCE_POLICY_DELETED", id, { slug: p.slug });
  return NextResponse.json({ ok: true });
}
