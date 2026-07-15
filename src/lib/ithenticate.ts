/**
 * Enterprise-tier plagiarism/integrity check via Turnitin's iThenticate
 * (Turnitin Core API / TCA) — a real, additional check alongside (not
 * replacing) the in-house pgvector similarity screen in
 * src/lib/manuscript-checks.ts. iThenticate has no free tier: a paid
 * subscription and signed EULA acceptance are prerequisites no code can
 * substitute for. This module makes the *code* fully real and ready the
 * moment ITHENTICATE_CLIENT_ID/ITHENTICATE_CLIENT_SECRET are configured,
 * while behaving honestly without them — simulation mode never fabricates
 * a similarity score; it completes with `similarityScore: null` and a log
 * naming the env vars that enable live mode.
 *
 * iThenticate's real submission flow is asynchronous (submit → the vendor
 * generates a report over some minutes → a webhook fires when it's ready,
 * received at src/app/api/webhooks/ithenticate/route.ts), unlike Zenodo's
 * single-request deposit or the in-house pgvector check's synchronous
 * scoring — hence the extra SUBMITTED job state between QUEUED and
 * COMPLETED (see IntegrityCheckJob in prisma/schema.prisma).
 *
 * NOTE: like src/lib/citations.ts's OpenAlex integration, this was built
 * against Turnitin's publicly documented TCA API conventions (OAuth2
 * client-credentials auth, EULA acceptance, submission + upload, then an
 * async similarity-report request) but has not been exercised against the
 * live API from this sandboxed environment, which has no outbound access
 * to vendor hosts. Confirm the exact endpoint paths and payload shapes
 * against Turnitin's current TCA documentation before enabling
 * ITHENTICATE_CLIENT_ID/SECRET in production.
 */
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";

const ITHENTICATE_API_BASE = "https://api.turnitin.com/api/v1";
const ITHENTICATE_TOKEN_URL = "https://api.turnitin.com/oauth/token";

/** True once real Turnitin/iThenticate OAuth2 client credentials are configured. */
export function ithenticateLiveMode(): boolean {
  return !!(process.env.ITHENTICATE_CLIENT_ID && process.env.ITHENTICATE_CLIENT_SECRET);
}

async function getAccessToken(): Promise<string> {
  const res = await fetch(ITHENTICATE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.ITHENTICATE_CLIENT_ID!,
      client_secret: process.env.ITHENTICATE_CLIENT_SECRET!,
      scope: "similarity-report",
    }),
  });
  if (!res.ok) {
    throw new Error(`iThenticate token request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const body = await res.json();
  return body.access_token;
}

/**
 * Creates a submission, uploads the manuscript, and requests a similarity
 * report. Returns the vendor's submission ID — the report itself arrives
 * later via webhook, not from this call.
 */
async function submitToIThenticate(
  token: string,
  articleId: string,
  articleTitle: string,
  manuscript: Buffer,
  manuscriptFilename: string
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "X-Turnitin-Integration-Name": "Eleventh Press International Publishing",
    "X-Turnitin-Integration-Version": "1.0",
  };

  const createRes = await fetch(`${ITHENTICATE_API_BASE}/submissions`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      owner: "editorial@eleventhpress.org",
      title: articleTitle,
      metadata: { external_id: articleId },
    }),
  });
  if (!createRes.ok) {
    throw new Error(`iThenticate submission create failed (${createRes.status}): ${(await createRes.text()).slice(0, 200)}`);
  }
  const submission = await createRes.json();
  const submissionId: string = submission.id;

  const uploadRes = await fetch(`${ITHENTICATE_API_BASE}/submissions/${submissionId}/original`, {
    method: "PUT",
    headers: { ...headers, "Content-Disposition": `inline; filename="${manuscriptFilename}"` },
    body: new Uint8Array(manuscript),
  });
  if (!uploadRes.ok) {
    throw new Error(`iThenticate manuscript upload failed (${uploadRes.status}): ${(await uploadRes.text()).slice(0, 200)}`);
  }

  const reportRes = await fetch(`${ITHENTICATE_API_BASE}/submissions/${submissionId}/similarity`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      generation_settings: {
        search_repositories: ["INTERNET", "PUBLICATION", "SUBMITTED_WORK"],
      },
    }),
  });
  if (!reportRes.ok) {
    throw new Error(`iThenticate similarity report request failed (${reportRes.status}): ${(await reportRes.text()).slice(0, 200)}`);
  }

  return submissionId;
}

/**
 * Runs a single IntegrityCheckJob — atomically claims it (same
 * updateMany-with-claimFilter race guard as runGalleyJob in
 * src/lib/galley-job.ts), then either submits it to the real iThenticate
 * API (live mode, ends in SUBMITTED — completion arrives via webhook) or
 * completes it immediately with an honest "not checked" result
 * (simulation mode — never a fabricated score).
 */
export async function runIntegrityCheckJob(
  jobId: string,
  triggeredBy: string | null = null,
  claimFilter: Record<string, unknown> = {}
): Promise<void> {
  const claimed = await db.integrityCheckJob.updateMany({
    where: { id: jobId, ...claimFilter },
    data: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
  });
  if (claimed.count !== 1) return;

  const job = await db.integrityCheckJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const article = await db.article.findUnique({ where: { id: job.articleId } });
  if (!article) {
    await db.integrityCheckJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: "Article no longer exists", completedAt: new Date() },
    });
    return;
  }

  if (!ithenticateLiveMode()) {
    await db.integrityCheckJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        mode: "simulation",
        similarityScore: null,
        workerLog: "Simulation mode: no ITHENTICATE_CLIENT_ID/ITHENTICATE_CLIENT_SECRET configured, so no submission was made and no score is available. Set both to enable a real iThenticate check.",
        completedAt: new Date(),
      },
    });
    return;
  }

  try {
    const manuscript = await getObject(job.inputKey);
    if (!manuscript) throw new Error(`Manuscript not found at ${job.inputKey}`);

    const token = await getAccessToken();
    const submissionId = await submitToIThenticate(
      token,
      article.id,
      article.title,
      manuscript,
      job.inputKey.split("/").pop() || "manuscript"
    );

    await db.integrityCheckJob.update({
      where: { id: jobId },
      data: {
        status: "SUBMITTED",
        mode: "live",
        externalSubmissionId: submissionId,
        workerLog: `Submitted to iThenticate as ${submissionId}; awaiting similarity report webhook.`,
      },
    });

    await db.auditLog.create({
      data: {
        userId: triggeredBy,
        action: "INTEGRITY_CHECK_SUBMITTED",
        entityType: "ARTICLE",
        entityId: article.id,
        articleId: article.id,
        metadata: JSON.stringify({ jobId, submissionId, trigger: triggeredBy ? "manual" : "system" }),
      },
    });
  } catch (e: any) {
    await db.integrityCheckJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: e.message, completedAt: new Date() },
    });
  }
}

/**
 * Batch entry point for the cron sweep — only recovers jobs that never
 * reached the vendor (QUEUED, or PROCESSING for longer than staleMinutes,
 * meaning the invocation that owned them died before submitting). A job
 * already SUBMITTED to the real API is deliberately left alone: retrying
 * it would create a duplicate paid submission rather than recovering
 * anything, so a SUBMITTED job that never gets its webhook requires
 * manual admin attention, not an automatic resubmit.
 */
export async function sweepStuckIntegrityChecks(limit = 5, staleMinutes = 10): Promise<{ swept: number; jobIds: string[] }> {
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const stuck = await db.integrityCheckJob.findMany({
    where: {
      OR: [
        { status: "QUEUED" },
        { status: "PROCESSING", startedAt: { lt: staleCutoff } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const job of stuck) {
    await runIntegrityCheckJob(job.id, null, {
      OR: [{ status: "QUEUED" }, { status: "PROCESSING", startedAt: { lt: staleCutoff } }],
    });
  }

  return { swept: stuck.length, jobIds: stuck.map((j) => j.id) };
}
