import crypto from "node:crypto";
import { db } from "@/lib/db";
import { sendEmail, notificationEmailHtml } from "@/lib/email";
import { emailBrandForTenantId } from "@/lib/email-brand";
import { APP_BASE_URL } from "@/lib/site";
import { notifyMany } from "@/lib/notify";

/**
 * Co-author confirmation. When a manuscript is submitted, every listed
 * co-author with an email address (other than the submitting author) is
 * emailed a private link to confirm their authorship and contribution
 * roles, or to flag a problem. Editors and the corresponding author see
 * the result in the submission tracker; a dispute notifies them at once.
 */

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

interface ListedAuthor {
  name?: string;
  email?: string;
  creditRoles?: string[];
}

export async function requestAuthorshipConfirmations(params: {
  articleId: string;
  title: string;
  authors: ListedAuthor[];
  submitterEmail: string;
  submitterName: string;
  tenantId?: string | null;
}): Promise<number> {
  const seen = new Set([params.submitterEmail.trim().toLowerCase()]);
  const brand = await emailBrandForTenantId(params.tenantId ?? null).catch(() => undefined);
  let sent = 0;
  for (const a of params.authors) {
    const email = (a.email || "").trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    const token = crypto.randomBytes(24).toString("base64url");
    await db.authorshipConfirmation.create({
      data: {
        articleId: params.articleId,
        email,
        name: (a.name || email).slice(0, 200),
        tokenHash: hashToken(token),
        creditRoles: (a.creditRoles || []).slice(0, 14),
      },
    });
    const url = `${APP_BASE_URL}/confirm-authorship?token=${token}`;
    const r = await sendEmail({
      to: email,
      subject: `Please confirm your authorship: "${params.title.slice(0, 80)}"`,
      html: notificationEmailHtml({
        title: "Please confirm your authorship",
        message: `${escapeHtml(params.submitterName)} has submitted “${escapeHtml(params.title)}” and listed you as a co-author. Please confirm that you're an author and that your contribution is described correctly — or let us know if something isn't right. It takes a few seconds.`,
        ctaUrl: url,
        ctaLabel: "Review and confirm",
        brand,
      }),
    });
    if (r.ok) sent++;
  }
  return sent;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function findConfirmation(token: string) {
  if (!token || token.length < 16) return null;
  return db.authorshipConfirmation.findUnique({ where: { tokenHash: hashToken(token) } });
}

/** Records a co-author's answer; a dispute notifies the corresponding author and the editors. */
export async function respondToConfirmation(token: string, confirm: boolean, comment?: string) {
  const row = await findConfirmation(token);
  if (!row) return { ok: false as const, error: "This link isn't valid." };
  if (row.status !== "PENDING") return { ok: true as const, status: row.status, already: true };
  const status = confirm ? "CONFIRMED" : "DISPUTED";
  await db.authorshipConfirmation.update({
    where: { id: row.id },
    data: { status, respondedAt: new Date(), comment: (comment || "").trim().slice(0, 2000) || null },
  });
  if (!confirm) {
    const article = await db.article.findUnique({ where: { id: row.articleId }, select: { title: true, correspondingAuthorId: true } });
    const editors = await db.user.findMany({ where: { role: { in: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"] } }, select: { id: true } });
    const recipients = [...new Set([article?.correspondingAuthorId, ...editors.map((e) => e.id)].filter(Boolean) as string[])];
    await notifyMany(
      recipients.map((userId) => ({
        userId,
        type: "WARNING" as const,
        category: userId === article?.correspondingAuthorId ? ("SUBMISSIONS" as const) : ("EDITORIAL" as const),
        link: userId === article?.correspondingAuthorId ? "/dashboard/my-articles" : "/dashboard/editor-queue",
        title: "A co-author flagged a problem",
        message: `${row.name} (${row.email}) says their authorship of "${article?.title ?? "a submission"}" isn't right.${comment ? ` Their note: “${comment.trim().slice(0, 300)}”` : ""}`,
        articleId: row.articleId,
      }))
    );
  }
  return { ok: true as const, status, already: false };
}
