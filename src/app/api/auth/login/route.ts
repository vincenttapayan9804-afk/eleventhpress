import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, signToken, needsPasswordRehash, hashPassword, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  try {
    const ip = extractRequestIp(req.headers);
    const rl = await checkRateLimit(`login:${ip}`, 10, 60);
    if (!rl.ok) {
      return NextResponse.json({ error: rl.message }, { status: 429 });
    }

    const { email, password } = (await req.json()) as { email?: string; password?: string };
    if (!email || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Transparent migrate-on-login: any account still on the pre-bcrypt
    // legacy SHA-256 hash gets re-hashed with bcrypt now that we know the
    // plaintext password was correct. The legacy verification branch in
    // verifyPassword() itself can be removed once a DB check confirms no
    // account still has a non-bcrypt passwordHash.
    if (needsPasswordRehash(user.passwordHash)) {
      await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        affiliation: user.affiliation,
        expertise: user.expertise,
        country: user.country,
        orcid: user.orcid,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
      },
    });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
