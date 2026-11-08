import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { ALERT_KINDS, alertLabel } from "@/lib/reading-alerts";

const MAX_ALERTS = 25;

/** Reading alerts. GET list · POST { kind, query, frequency } · DELETE ?id= · PATCH { id, frequency } */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const alerts = await db.readingAlert.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ alerts: alerts.map((a) => ({ ...a, label: alertLabel(a.kind, a.query) })) });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { kind?: string; query?: string; frequency?: string };
  const kind = (ALERT_KINDS as readonly string[]).includes(b.kind || "") ? b.kind! : null;
  const query = (b.query || "").trim().slice(0, 120) || (kind === "MAGAZINE" ? "magazines" : "");
  if (!kind || !query) return NextResponse.json({ error: "Choose what to be alerted about" }, { status: 400 });
  const frequency = b.frequency === "DAILY" ? "DAILY" : "WEEKLY";
  const count = await db.readingAlert.count({ where: { userId: session.userId } });
  if (count >= MAX_ALERTS) return NextResponse.json({ error: `You can keep up to ${MAX_ALERTS} alerts` }, { status: 400 });
  const existing = await db.readingAlert.findFirst({ where: { userId: session.userId, kind, query: { equals: query, mode: "insensitive" } } });
  if (existing) return NextResponse.json({ alert: { ...existing, label: alertLabel(kind, query) }, existing: true });
  const alert = await db.readingAlert.create({ data: { userId: session.userId, kind, query, frequency, lastSentAt: new Date() } });
  return NextResponse.json({ alert: { ...alert, label: alertLabel(kind, query) } });
}

export async function PATCH(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; frequency?: string };
  if (!b.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db.readingAlert.updateMany({ where: { id: b.id, userId: session.userId }, data: { frequency: b.frequency === "DAILY" ? "DAILY" : "WEEKLY" } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db.readingAlert.deleteMany({ where: { id, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
