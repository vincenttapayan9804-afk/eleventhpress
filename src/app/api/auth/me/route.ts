import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { ACADEMIC_STATUS_OPTIONS } from "@/lib/roles";

const PROFILE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  expertTier: true,
  affiliation: true,
  expertise: true,
  country: true,
  orcid: true,
  bio: true,
  avatarUrl: true,
  profession: true,
  website: true,
  twitterUrl: true,
  linkedinUrl: true,
  githubUrl: true,
  contactEmail: true,
  contactPhone: true,
  bloggerBlogUrl: true,
  bloggerConnectedAt: true,
  twoFactorEnabled: true,
  departmentId: true,
  academicStatus: true,
} as const;

export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: PROFILE_SELECT,
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ user });
}

/**
 * PATCH /api/auth/me
 * Self-service profile editor — every user can update their own public
 * profile: full name, avatar, profession, bio, social links, and public
 * contact info. Deliberately excludes email/password/role/affiliation —
 * those are identity fields handled elsewhere (or, for role, never
 * self-service).
 */
const MAX_LEN: Record<string, number> = {
  profession: 200,
  bio: 4000,
  avatarUrl: 2000,
  website: 500,
  twitterUrl: 500,
  linkedinUrl: 500,
  githubUrl: 500,
  contactEmail: 320,
  contactPhone: 40,
};

const URL_FIELDS = new Set(["avatarUrl", "website", "twitterUrl", "linkedinUrl", "githubUrl"]);
const EDITABLE_FIELDS = Object.keys(MAX_LEN);

/** Trims, empty-string-to-null, length-caps. URL fields get a scheme prepended and are validated as parseable URLs (relative /api/storage/... paths are also accepted, for local-dev-mode avatars). */
function sanitizeField(key: string, raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined; // not provided — leave unchanged
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  let value = raw.trim();
  if (value.length === 0) return null;
  if (value.length > MAX_LEN[key]) value = value.slice(0, MAX_LEN[key]);

  if (URL_FIELDS.has(key)) {
    if (value.startsWith("/")) return value; // relative storage URL (local-dev avatar mode)
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    try {
      new URL(value);
    } catch {
      return undefined; // invalid — drop the change rather than save garbage
    }
  }

  if (key === "contactEmail" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return undefined;
  }

  return value;
}

export async function PATCH(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, string | null> = {};
  for (const key of EDITABLE_FIELDS) {
    const sanitized = sanitizeField(key, body[key]);
    if (sanitized !== undefined) data[key] = sanitized;
  }

  // fullName is a required identity field, so it can't go through
  // sanitizeField's empty-string-to-null path like the optional fields above.
  if (typeof body.fullName === "string") {
    const trimmed = body.fullName.trim().slice(0, 200);
    if (trimmed.length === 0) {
      return NextResponse.json({ error: "Full name cannot be empty" }, { status: 400 });
    }
    data.fullName = trimmed;
  }

  // EP University OS Phase 1 — self-service, same posture as
  // SELF_SELECTABLE_ROLES: choosing your own academic status/department is
  // identity disclosure, not a privilege grant. departmentId is validated
  // against the caller's own tenant (rejected, not silently dropped, since
  // a silent drop would look like a UI bug); a session with no tenantId
  // (pre-Phase-1 token) can't set one.
  const universityData: Record<string, string | null> = {};
  if ("academicStatus" in body) {
    if (body.academicStatus === null) {
      universityData.academicStatus = null;
    } else if (typeof body.academicStatus === "string" && ACADEMIC_STATUS_OPTIONS.includes(body.academicStatus)) {
      universityData.academicStatus = body.academicStatus;
    } else {
      return NextResponse.json({ error: `academicStatus must be one of: ${ACADEMIC_STATUS_OPTIONS.join(", ")}, or null` }, { status: 400 });
    }
  }
  if ("departmentId" in body) {
    if (body.departmentId === null) {
      universityData.departmentId = null;
    } else if (typeof body.departmentId === "string") {
      if (!session.tenantId) {
        return NextResponse.json({ error: "Your session has no tenant context" }, { status: 400 });
      }
      const department = await db.department.findUnique({ where: { id: body.departmentId } });
      if (!department || department.tenantId !== session.tenantId) {
        return NextResponse.json({ error: "departmentId must belong to your own tenant" }, { status: 400 });
      }
      universityData.departmentId = body.departmentId;
    } else {
      return NextResponse.json({ error: "departmentId must be a string or null" }, { status: 400 });
    }
  }
  Object.assign(data, universityData);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: session.userId },
    data,
    select: PROFILE_SELECT,
  });

  return NextResponse.json({ user });
}
