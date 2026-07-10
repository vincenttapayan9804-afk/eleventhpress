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

    const validRoles = ["READER", "AUTHOR", "REVIEWER", "ASSOCIATE_EDITOR", "EDITOR", "SUPER_ADMIN"];
    const finalRole = validRoles.includes(role || "") ? role! : "READER";

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
      },
    });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
