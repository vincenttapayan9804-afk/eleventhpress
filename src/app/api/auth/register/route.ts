import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, signToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";
import { SELF_SELECTABLE_ROLES, APPLICATION_ROLES } from "@/lib/roles";
import { isPasswordBreached } from "@/lib/password-breach";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { parseBody } from "@/lib/validate";

const MIN_PASSWORD_LENGTH = 8;

// `role` intentionally accepts any non-empty string here, not an enum of
// SELF_SELECTABLE_ROLES/APPLICATION_ROLES — the handler below already
// applies that allow-list logic (falling back to READER, or filing a
// RoleApplication) and duplicating it in the schema would just be a second
// place for the two lists to drift apart.
const RegisterSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
  fullName: z.string().trim().min(1).max(200),
  role: z.string().max(50).optional(),
  affiliation: z.string().max(300).optional(),
  expertise: z.string().max(500).optional(),
  country: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Looser than login's 10/min — registration is rarer and legitimately
    // bursty from a shared NAT/campus IP, so a login-brute-force-style
    // limit isn't appropriate here.
    const ip = extractRequestIp(req.headers);
    const rl = await checkRateLimit(`register:${ip}`, 5, 60);
    if (!rl.ok) {
      return NextResponse.json({ error: rl.message }, { status: 429 });
    }

    const parsed = await parseBody(req, RegisterSchema);
    if (!parsed.ok) return parsed.response;
    const { email, password, fullName, role, affiliation, expertise, country } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    if (await isPasswordBreached(password)) {
      return NextResponse.json(
        { error: "This password has appeared in a known data breach. Please choose a different password." },
        { status: 400 }
      );
    }

    const needsApplication = APPLICATION_ROLES.includes(role || "");
    const finalRole = SELF_SELECTABLE_ROLES.includes(role || "") ? role! : "READER";

    const user = await db.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        fullName,
        role: finalRole,
        affiliation: affiliation || null,
        expertise: expertise || null,
        country: country || null,
      },
    });

    let pendingApplication = false;
    if (needsApplication) {
      await db.roleApplication.create({
        data: {
          userId: user.id,
          requestedRole: role!,
          status: "PENDING",
        },
      });
      pendingApplication = true;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    const res = NextResponse.json({
      pendingApplication,
      requestedRole: needsApplication ? role : undefined,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        affiliation: user.affiliation,
        expertise: user.expertise,
        country: user.country,
        avatarUrl: user.avatarUrl,
      },
    });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
