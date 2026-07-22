import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, signToken, needsPasswordRehash, hashPassword, signPendingTwoFactorToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { isLocked, lockoutMinutesFor, minutesRemaining } from "@/lib/account-lockout";
import { parseBody } from "@/lib/validate";

// Not `.email()` — that would reject a request before we ever compare it
// against an existing account, disclosing "well-formed vs not" for free.
// Plain presence + a length cap (RFC 5321's practical max) is enough here.
const LoginSchema = z.object({
  email: z.string().min(1).max(254),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    const ip = extractRequestIp(req.headers);
    const rl = await checkRateLimit(`login:${ip}`, 10, 60);
    if (!rl.ok) {
      return NextResponse.json({ error: rl.message }, { status: 429 });
    }

    const userAgent = req.headers.get("user-agent") || null;
    const parsed = await parseBody(req, LoginSchema);
    if (!parsed.ok) return parsed.response;
    const { email, password } = parsed.data;

    // Per-account throttling, on top of the per-IP limit above — an
    // attacker spreading guesses across many IPs would otherwise face no
    // limit at all on how many passwords they can try against one account.
    const accountRl = await checkRateLimit(`login-account:${email.toLowerCase()}`, 10, 900);
    if (!accountRl.ok) {
      return NextResponse.json({ error: accountRl.message }, { status: 429 });
    }

    const user = await db.user.findUnique({ where: { email } });

    // Checked before the password itself: a locked account should reject
    // every attempt — including the correct password — until the lock
    // expires, so this account-side gate is unconditionally enforced
    // (unlike checkRateLimit, which can run in simulation mode without
    // Upstash configured).
    if (user && isLocked(user.lockedUntil)) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${minutesRemaining(user.lockedUntil!)} minute(s).` },
        { status: 423 }
      );
    }

    if (!user || user.deletedAt || !verifyPassword(password, user.passwordHash)) {
      // userId stays null — no session/actor is established for a failed
      // attempt, and (for the !user case) there may be no real account at
      // all. entityId falls back to the attempted email so failed logins
      // against the same target are still correlatable.
      await db.auditLog.create({
        data: {
          action: "LOGIN_FAILURE",
          entityType: "USER",
          entityId: user?.id ?? email,
          metadata: JSON.stringify({ ip, userAgent, email }),
        },
      }).catch(() => {});

      // Only a real account can be locked — there's no row to mark for a
      // non-existent email, and the rate limits above already throttle
      // that case regardless.
      if (user) {
        const failedLoginCount = user.failedLoginCount + 1;
        const lockMinutes = lockoutMinutesFor(failedLoginCount);
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount,
            ...(lockMinutes ? { lockedUntil: new Date(Date.now() + lockMinutes * 60_000) } : {}),
          },
        }).catch(() => {});
      }

      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Successful login clears any accumulated failure history.
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } }).catch(() => {});
    }

    // Transparent migrate-on-login: any account still on the pre-bcrypt
    // legacy SHA-256 hash gets re-hashed with bcrypt now that we know the
    // plaintext password was correct. The legacy verification branch in
    // verifyPassword() itself can be removed once a DB check confirms no
    // account still has a non-bcrypt passwordHash.
    if (needsPasswordRehash(user.passwordHash)) {
      await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } });
    }

    if (user.twoFactorEnabled) {
      // Password alone is not enough — hand back a narrow, 5-minute
      // "pending" token that only /api/auth/2fa/challenge can redeem, and
      // no session cookie yet.
      return NextResponse.json({
        twoFactorRequired: true,
        pendingToken: signPendingTwoFactorToken(user.id),
      });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN_SUCCESS",
        entityType: "USER",
        entityId: user.id,
        metadata: JSON.stringify({ ip, userAgent }),
      },
    }).catch(() => {});

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
