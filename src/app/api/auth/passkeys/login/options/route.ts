import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { relyingParty, setChallenge } from "@/lib/passkeys";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";

/** POST — WebAuthn options for signing in with a passkey (discoverable: no email needed). */
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(`passkey-login:${extractRequestIp(req.headers)}`, 20, 60);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });
  const { rpID } = relyingParty(req);
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
  const res = NextResponse.json(options);
  setChallenge(res, options.challenge, "login");
  return res;
}
