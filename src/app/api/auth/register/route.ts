import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName, role, affiliation, expertise, country } = body as {
      email?: string;
      password?: string;
      fullName?: string;
      role?: string;
      affiliation?: string;
      expertise?: string;
      country?: string;
    };

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Self-registration may only ever self-select READER or AUTHOR — both
    // are "low trust" in the sense that they only ever act on the
    // registrant's own data (submitting their own manuscript, reading their
    // own subscription). REVIEWER, ASSOCIATE_EDITOR, EDITOR, and SUPER_ADMIN
    // grant access to *other* people's submissions/reviews or admin
    // functions, so those can only be granted by an existing admin via
    // POST /api/admin/users/[id]/role — a public, unauthenticated endpoint
    // must never accept a client-supplied privileged role.
    const SELF_SELECTABLE_ROLES = ["READER", "AUTHOR"];
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

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    return NextResponse.json({
      token,
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
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
