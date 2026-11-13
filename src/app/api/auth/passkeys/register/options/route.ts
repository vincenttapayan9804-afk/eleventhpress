import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { relyingParty, setChallenge } from "@/lib/passkeys";
import { publisherIdentityForTenantId } from "@/lib/publisher-identity";

/** POST — WebAuthn registration options for adding a passkey to the signed-in account. */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { rpID } = relyingParty(req);
  // The name the device shows when saving the passkey: the account's
  // whitelabel institution, or "Eleventh Press".
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { tenantId: true } });
  const rpName = (await publisherIdentityForTenantId(user?.tenantId ?? session.tenantId)).shortName;
  const existing = await db.passkey.findMany({ where: { userId: session.userId }, select: { credentialId: true, transports: true } });
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: session.email,
    userDisplayName: session.fullName,
    userID: new TextEncoder().encode(session.userId),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports as any })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  const res = NextResponse.json(options);
  setChallenge(res, options.challenge, "register", session.userId);
  return res;
}
