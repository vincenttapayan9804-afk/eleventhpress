import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

/**
 * POST /api/webhooks/ithenticate
 *
 * Receives the async "similarity report ready" callback from Turnitin's
 * iThenticate API once a live-mode submission (src/lib/ithenticate.ts)
 * finishes generating its report — this is what moves an
 * IntegrityCheckJob from SUBMITTED to COMPLETED and writes the score onto
 * Article. Verifies an HMAC-SHA256 signature against
 * ITHENTICATE_WEBHOOK_SECRET before trusting the payload, the same
 * "never trust the body without verifying it's genuinely from the vendor"
 * rule the billing webhooks (src/app/api/billing/webhook/[provider])
 * follow. As with the rest of src/lib/ithenticate.ts, the exact header
 * name/signing scheme here is a best-effort implementation of Turnitin's
 * documented convention, unverified against the live API from this
 * sandboxed environment — confirm against current TCA webhook docs before
 * relying on it in production.
 */
function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(signatureHeader, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.ITHENTICATE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ITHENTICATE_WEBHOOK_SECRET not configured" }, { status: 403 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-turnitin-signature");
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const submissionId: string | undefined = event.submission_id;
  const status: string | undefined = event.status;
  if (!submissionId) {
    return NextResponse.json({ received: true, actioned: false });
  }

  const job = await db.integrityCheckJob.findFirst({
    where: { externalSubmissionId: submissionId, provider: "ITHENTICATE" },
  });
  if (!job) {
    // Acknowledge — an unrecognized submission ID isn't something we can
    // act on, but returning an error would just make the vendor retry.
    return NextResponse.json({ received: true, actioned: false });
  }

  if (status !== "COMPLETE") {
    await db.integrityCheckJob.update({
      where: { id: job.id },
      data: { workerLog: `Webhook received with status "${status}" — not yet complete.` },
    });
    return NextResponse.json({ received: true, actioned: false });
  }

  const similarityScore: number | undefined = event.similarity?.overall_match_percentage;
  const reportUrl: string | undefined = event.similarity?.viewer_url;

  await db.integrityCheckJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      similarityScore: similarityScore ?? null,
      reportUrl: reportUrl ?? null,
      matchBreakdown: event.similarity ? JSON.stringify(event.similarity) : null,
      completedAt: new Date(),
    },
  });

  await db.article.update({
    where: { id: job.articleId },
    data: {
      ithenticateScore: similarityScore ?? null,
      ithenticateReportUrl: reportUrl ?? null,
      ithenticateCheckedAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      action: "INTEGRITY_CHECK_COMPLETED",
      entityType: "ARTICLE",
      entityId: job.articleId,
      articleId: job.articleId,
      metadata: JSON.stringify({ jobId: job.id, submissionId, similarityScore }),
    },
  });

  return NextResponse.json({ received: true, actioned: true });
}
