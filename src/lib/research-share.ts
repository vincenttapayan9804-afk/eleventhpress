/**
 * Read-only shared Research Assistant conversations (/research/shared/<token>).
 *
 * A reader who is signed in can create a share link for one of their
 * conversations and revoke it at any time. The shared view holds only the
 * questions and the assistant's answers with their citations and sources:
 * never the reader's name, saved flags or collections. A link works only
 * on the site of the institution the conversation was held on.
 */
import { db } from "@/lib/db";
import { parsePayload } from "@/lib/research-assistant";
import type { TenantContext } from "@/lib/tenant";

export interface SharedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  data?: unknown;
}

export interface SharedConversation {
  title: string;
  sharedAt: string | null;
  updatedAt: string;
  messages: SharedMessage[];
}

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/** Keeps only what a shared view needs from an answer's stored payload. */
function publicPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return undefined;
  const p = raw as Record<string, unknown>;
  return {
    grounded: p.grounded,
    intent: p.intent,
    citations: Array.isArray(p.citations) ? p.citations : [],
    sources: Array.isArray(p.sources) ? p.sources : [],
    evidence: p.evidence,
    coverage: p.coverage,
    answeredAt: p.answeredAt,
  };
}

export async function loadSharedConversation(token: string, tenant: TenantContext | null): Promise<SharedConversation | null> {
  if (!TOKEN.test(token)) return null;
  const c = await db.researchConversation
    .findFirst({
      where: { shareToken: token },
      select: {
        title: true,
        tenantId: true,
        sharedAt: true,
        updatedAt: true,
        messages: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true, payload: true, createdAt: true } },
      },
    })
    .catch(() => null);
  if (!c) return null;
  // Only on the institution's own site (the platform's links on the platform).
  if (c.tenantId && tenant && c.tenantId !== tenant.id) return null;
  return {
    title: c.title,
    sharedAt: c.sharedAt?.toISOString() ?? null,
    updatedAt: c.updatedAt.toISOString(),
    messages: c.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        ...(m.role === "assistant" ? { data: publicPayload(parsePayload(m.payload)) } : {}),
      })),
  };
}
