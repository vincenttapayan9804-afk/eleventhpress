/**
 * GDPR/CCPA data-subject rights: export (Art. 20 portability) and erasure
 * (Art. 17). Erasure is implemented as in-place anonymization, not a row
 * delete — this account has ~30 enforced foreign-key relations (Article
 * authorship, Review, EditorialDecision, Invoice, AuditLog, Certificate…)
 * and, per Art. 17(3)(d), the already-published scholarly record a user
 * co-authored or reviewed is exempt from erasure as archiving carried out
 * for scientific research / in the public interest. Anonymizing in place
 * keeps every existing foreign key resolving (nothing orphaned, no cascade
 * needed) while scrubbing every field that is actually personal data.
 */
import { db } from "@/lib/db";
import crypto from "crypto";

export async function exportUserAccountData(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      affiliation: true,
      orcid: true,
      bio: true,
      expertise: true,
      country: true,
      avatarUrl: true,
      profession: true,
      website: true,
      twitterUrl: true,
      linkedinUrl: true,
      githubUrl: true,
      contactEmail: true,
      contactPhone: true,
      twoFactorEnabled: true,
      institutionId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) return null;

  const [submissions, reviews, invoices, notifications, certificates, authorResponses] = await Promise.all([
    db.article.findMany({
      where: { correspondingAuthorId: userId },
      select: { id: true, title: true, doi: true, status: true, submittedAt: true, publishedAt: true },
    }),
    db.review.findMany({
      where: { reviewerId: userId },
      select: { id: true, articleId: true, status: true, recommendation: true, createdAt: true, completedAt: true },
    }),
    db.invoice.findMany({
      where: { userId },
      select: { id: true, type: true, amount: true, currency: true, status: true, paidAt: true, createdAt: true },
    }),
    db.notification.findMany({
      where: { userId },
      select: { id: true, type: true, title: true, message: true, read: true, createdAt: true },
    }),
    db.certificate.findMany({
      where: { userId },
      select: { id: true, type: true, serialNumber: true, issuedAt: true },
    }),
    db.authorResponse.findMany({
      where: { authorId: userId },
      select: { id: true, articleId: true, content: true, createdAt: true },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: user,
    submissions,
    reviewsPerformed: reviews,
    invoices,
    notifications,
    certificates,
    authorResponses,
  };
}

/** Random, never-derivable replacement so the retired login can never be re-verified against any known password. */
function unusableSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export interface AnonymizeResult {
  ok: true;
}

export async function anonymizeUserAccount(userId: string): Promise<AnonymizeResult> {
  const suffix = userId.slice(-8);

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${suffix}@deleted.eleventhpress.invalid`,
        fullName: "Deleted User",
        passwordHash: unusableSecret(),
        affiliation: null,
        orcid: null,
        bio: null,
        expertise: null,
        country: null,
        avatarUrl: null,
        profession: null,
        website: null,
        twitterUrl: null,
        linkedinUrl: null,
        githubUrl: null,
        contactEmail: null,
        contactPhone: null,
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorBackupCodes: null,
        orcidAccessToken: null,
        orcidRefreshToken: null,
        orcidTokenExpiry: null,
        orcidLastSync: null,
        bloggerAccessToken: null,
        bloggerRefreshToken: null,
        bloggerTokenExpiry: null,
        bloggerBlogId: null,
        bloggerBlogUrl: null,
        bloggerConnectedAt: null,
        institutionId: null,
        deletedAt: new Date(),
      },
    }),
    // Purely personal — nothing else references a Notification row.
    db.notification.deleteMany({ where: { userId } }),
  ]);

  return { ok: true };
}
