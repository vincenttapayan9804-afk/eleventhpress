/**
 * Everything the public certificate verification page (/verify/[serial]),
 * its JSON check (/api/certificates/verify/[serial]) and its PDF
 * verification report render from — one live check per request, so the
 * page, the JSON and the PDF can never disagree.
 *
 * The check: the certificate's content hash is recomputed from the fields
 * actually stored on its row (canonicalCertificatePayload) and compared
 * with the hash printed on the certificate. Any alteration to a
 * downloaded/printed copy — a changed name, date, capacity or work title —
 * won't match. Verification depends on this platform's own records; it is
 * tamper-evident, not blockchain-anchored.
 */
import { db } from "@/lib/db";
import { APP_BASE_URL } from "@/lib/site";
import {
  CERTIFICATE_CATEGORY_LABELS,
  CERTIFICATE_TYPE_LABELS,
  canonicalCertificatePayload,
  type CertificateCategory,
  type CertificatePayload,
  type CertificateType,
} from "@/lib/certificates";
import { computeContentHash } from "@/lib/certificates-server";

export { CERTIFICATE_SEALED_FIELDS } from "@/lib/certificate-verification-fields";

export interface CertificateTimelineEvent {
  kind: "issued" | "regenerated" | "verified";
  at: string;
  label: string;
  detail?: string;
}

export interface CertificateRecord {
  id: string;
  serialNumber: string;
  type: CertificateType;
  typeLabel: string;
  category: CertificateCategory;
  categoryLabel: string;
  recipientName: string;
  workTitle: string | null;
  issuer: string;
  issn: string | null;
  issuedAt: string;
  contentHash: string;
  recomputedHash: string;
  verdict: "verified" | "mismatch";
  checks: { located: true; payload: boolean; serial: boolean };
  checkedAt: string;
  templateVersion: number;
  canonicalPayload: string;
  timeline: CertificateTimelineEvent[];
  urls: { verify: string; api: string; report: string };
}

export type CertificateLookup = { kind: "not-found" } | { kind: "found"; record: CertificateRecord };

// "EP-…" for the platform; a whitelabel tenant uses its own initials ("RP-REC-…").
const SERIAL_PATTERN = /^[A-Z]{2,5}-[A-Z]+-[0-9A-F]+$/i;

/** Pure part of the check: the payload hashed at issuance, rebuilt from the row. */
export function certificatePayloadFromRow(row: {
  serialNumber: string;
  type: string;
  category: string;
  recipientName: string;
  issuedAt: Date;
  journalName: string;
  issn: string | null;
  workTitle: string | null;
}): CertificatePayload {
  return {
    serialNumber: row.serialNumber,
    type: row.type as CertificateType,
    category: row.category as CertificateCategory,
    recipientName: row.recipientName,
    issuedAtIso: row.issuedAt.toISOString(),
    journalName: row.journalName,
    issn: row.issn,
    workTitle: row.workTitle,
  };
}

export async function loadCertificateRecord(serialNumber: string, now = new Date()): Promise<CertificateLookup> {
  const serial = serialNumber.trim();
  if (!serial || serial.length > 80) return { kind: "not-found" };
  const certificate = await db.certificate.findUnique({ where: { serialNumber: serial } });
  if (!certificate) return { kind: "not-found" };

  const payload = certificatePayloadFromRow(certificate);
  const recomputedHash = computeContentHash(payload);
  const payloadMatches = recomputedHash === certificate.contentHash;

  const audit = await db.auditLog
    .findMany({
      where: { entityType: "CERTIFICATE", entityId: certificate.id, action: { in: ["CERTIFICATE_ISSUED", "CERTIFICATE_REGENERATED"] } },
      orderBy: { createdAt: "asc" },
      select: { action: true, createdAt: true },
      take: 20,
    })
    .catch(() => [] as { action: string; createdAt: Date }[]);

  const verdict = payloadMatches ? "verified" : "mismatch";
  const checkedAt = now.toISOString();
  const typeLabel = CERTIFICATE_TYPE_LABELS[certificate.type as CertificateType] ?? certificate.type;
  const categoryLabel = CERTIFICATE_CATEGORY_LABELS[certificate.category as CertificateCategory] ?? certificate.category;

  const timeline: CertificateTimelineEvent[] = [
    {
      kind: "issued",
      at: certificate.issuedAt.toISOString(),
      label: `${typeLabel} issued`,
      detail: `Issued to ${certificate.recipientName} as ${categoryLabel}, and its content hash recorded.`,
    },
    ...audit
      .filter((a) => a.action === "CERTIFICATE_REGENERATED")
      .map((a) => ({
        kind: "regenerated" as const,
        at: a.createdAt.toISOString(),
        label: "Document re-rendered",
        detail: "The PDF was re-rendered with the publisher's current certificate design. Serial number and issue date are unchanged.",
      })),
    {
      kind: "verified",
      at: checkedAt,
      label: payloadMatches ? "Independently re-verified (this check)" : "Re-verification failed (hash mismatch)",
    },
  ];

  const enc = encodeURIComponent(certificate.serialNumber);
  return {
    kind: "found",
    record: {
      id: certificate.id,
      serialNumber: certificate.serialNumber,
      type: certificate.type as CertificateType,
      typeLabel,
      category: certificate.category as CertificateCategory,
      categoryLabel,
      recipientName: certificate.recipientName,
      workTitle: certificate.workTitle,
      issuer: certificate.journalName,
      issn: certificate.issn,
      issuedAt: certificate.issuedAt.toISOString(),
      contentHash: certificate.contentHash,
      recomputedHash,
      verdict,
      checks: { located: true, payload: payloadMatches, serial: SERIAL_PATTERN.test(certificate.serialNumber) },
      checkedAt,
      templateVersion: certificate.templateVersion,
      canonicalPayload: canonicalCertificatePayload(payload),
      timeline,
      urls: {
        verify: `${APP_BASE_URL}/verify/${enc}`,
        api: `${APP_BASE_URL}/api/certificates/verify/${enc}`,
        report: `${APP_BASE_URL}/api/certificates/verify/${enc}/report`,
      },
    },
  };
}
