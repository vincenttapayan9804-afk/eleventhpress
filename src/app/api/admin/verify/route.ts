import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";

const ADMIN_PASSWORD = process.env.ADMIN_PORTAL_PASSWORD || "epip-admin-2024";

export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { password } = (await req.json()) as { password?: string };
  if (!password || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid admin password" }, { status: 403 });
  }

  return NextResponse.json({ verified: true });
}
