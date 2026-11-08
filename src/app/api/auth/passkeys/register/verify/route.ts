import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { clearChallenge, defaultPasskeyName, readChallenge, relyingParty } from "@/lib/passkeys";
import { sendSecurityEmail } from "@/lib/account-emails";

/** POST { response, name? } — verifies the new passkey and saves it to the account. */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const pending = readChallenge(req, "register");
  if (!pending || pending.userId !== session.userId) {
    return NextResponse.json({ error: "That took too long — please try again." }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { response?: any; name?: string };
  const { rpID, origin } = relyingParty(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Passkey couldn't be verified" }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Passkey couldn't be verified" }, { status: 400 });
  }
  const { credential } = verification.registrationInfo;
  const passkey = await db.passkey.create({
    data: {
      userId: session.userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      name: (body.name || "").trim().slice(0, 60) || defaultPasskeyName(req.headers.get("user-agent")),
    },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
  });
  await db.auditLog.create({ data: { userId: session.userId, action: "PASSKEY_ADDED", entityType: "USER", entityId: session.userId } }).catch(() => {});
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { email: true, fullName: true, tenantId: true } });
  if (user) await sendSecurityEmail(user, { kind: "passkey_added", name: passkey.name }).catch(() => {});
  const res = NextResponse.json({ passkey });
  clearChallenge(res);
  return res;
}
