import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getSessionFromHeaders } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";

// Unlike SESSION_SECRET/FIELD_ENCRYPTION_KEY, this is checked per-request
// rather than thrown at module load: those two are load-bearing (every
// session and every OAuth token depends on them), so failing the whole
// build/boot when they're missing is correct. This is one optional
// second-factor gate on a route already restricted to SUPER_ADMIN — it
// should fail closed on its own if unconfigured, not take the entire
// production deploy down over a single admin convenience feature.
const DEV_ONLY_FALLBACK_PASSWORD = "epip-admin-2024";

function getAdminPassword(): string | null {
  if (process.env.ADMIN_PORTAL_PASSWORD) return process.env.ADMIN_PORTAL_PASSWORD;
  return process.env.NODE_ENV !== "production" ? DEV_ONLY_FALLBACK_PASSWORD : null;
}

function safeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await checkRateLimit(`admin-portal-verify:${session.userId}`, 5, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    return NextResponse.json(
      { error: "Admin Portal password is not configured (ADMIN_PORTAL_PASSWORD unset)" },
      { status: 503 }
    );
  }

  const { password } = (await req.json()) as { password?: string };
  if (!password || !safeStringEqual(password, adminPassword)) {
    return NextResponse.json({ error: "Invalid admin password" }, { status: 403 });
  }

  return NextResponse.json({ verified: true });
}
