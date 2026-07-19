import crypto from "crypto";
import { canonicalArticleProvenancePayload, type ArticleProvenancePayload } from "@/lib/article-provenance";

/** Server-only half — needs Node's `crypto`, split out for the same reason
 * certificates-server.ts is split from certificates.ts. */
export function computeArticleContentHash(p: ArticleProvenancePayload): string {
  return crypto.createHash("sha256").update(canonicalArticleProvenancePayload(p)).digest("hex");
}

export function sha256(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
