import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { clearChallenge, readChallenge, relyingParty } from "@/lib/passkeys";
import { startSession } from "@/lib/user-sessions";
import { workspaceOf } from "@/lib/workspace";
import { noteSignIn } from "@/lib/account-emails";
import { extractRequestIp } from "@/lib/institutions";
import { isLocked, minutesRemaining } from "@/lib/account-lockout";

/**
 * POST { response } — completes passkey sign-in: verifies the assertion
 * against the stored credential and starts a session, exactly as a
 * password sign-in does. A passkey is itself two factors (the device plus
 * its biometric or PIN), so no further code is asked for.
 */
export async function POST(req: NextRequest) {
  const pending = readChallenge(req, "login");
  if (!pending) return NextResponse.json({ error: "That took too long — please try again." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { response?: any };
  const credentialId = body.response?.id;
  if (typeof credentialId !== "string") return NextResponse.json({ error: "Missing passkey response" }, { status: 400 });

  const passkey = await db.passkey.findUnique({ where: { credentialId } });
  if (!passkey) return NextResponse.json({ error: "This passkey isn't registered here. Sign in with your password, then add it from your profile." }, { status: 404 });

  const { rpID, origin } = relyingParty(req);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: passkey.credentialId, publicKey: new Uint8Array(passkey.publicKey), counter: passkey.counter, transports: passkey.transports as any },
      requireUserVerification: false,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Passkey couldn't be verified" }, { status: 400 });
  }
  if (!verification.verified) return NextResponse.json({ error: "Passkey couldn't be verified" }, { status: 400 });

  const user = await db.user.findUnique({ where: { id: passkey.userId } });
  if (!user || user.deletedAt) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (isLocked(user.lockedUntil)) {
    return NextResponse.json({ error: `Sign-in is paused. Try again in ${minutesRemaining(user.lockedUntil!)} minute(s).` }, { status: 423 });
  }

  await db.passkey.update({ where: { id: passkey.id }, data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() } });
  const ip = extractRequestIp(req.headers);
  const userAgent = req.headers.get("user-agent");
  await db.auditLog
    .create({ data: { userId: user.id, action: "LOGIN_SUCCESS", entityType: "USER", entityId: user.id, metadata: JSON.stringify({ ip, userAgent, method: "passkey" }) } })
    .catch(() => {});

  const token = signToken({ userId: user.id, email: user.email, role: user.role, fullName: user.fullName, ...(user.tenantId ? { tenantId: user.tenantId } : {}) });
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
      tenantId: user.tenantId ?? null,
      mustChangePassword: user.mustChangePassword,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
      emailVerifiedAt: user.emailVerifiedAt,
      workspace: await workspaceOf(user.tenantId),
    },
  });
  clearChallenge(res);
  await startSession(req, res, token);
  await noteSignIn(req, res, user, { ip, userAgent });
  return res;
}
