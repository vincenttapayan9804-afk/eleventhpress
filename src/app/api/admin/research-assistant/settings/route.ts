import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assistantAdminScope } from "@/lib/research-assistant-admin";
import {
  clearAssistantSettingsCache,
  DEFAULT_ANONYMOUS_HOURLY,
  DEFAULT_SIGNED_IN_HOURLY,
  getAssistantSettings,
  sanitizeSettingsInput,
  SETTINGS_BOUNDS,
} from "@/lib/research-assistant-settings";
import { conversationRetentionDays } from "@/lib/research-assistant";

/**
 * GET /api/admin/research-assistant/settings — the institution's
 *     Research Assistant settings (on/off, disclaimer, retention, starter
 *     questions, hourly limits, question logging) and the defaults.
 * PUT — saves them. Institution admins change their own institution's;
 *     the platform super admin the platform's, or any institution's with
 *     ?tenantId=.
 */
export async function GET(req: NextRequest) {
  const scope = await assistantAdminScope(req.headers, req.nextUrl.searchParams.get("tenantId"));
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (scope.all || !scope.tenantId) return NextResponse.json({ error: "Choose an institution" }, { status: 400 });
  clearAssistantSettingsCache(scope.tenantId);
  const settings = await getAssistantSettings(scope.tenantId);
  return NextResponse.json({
    tenantId: scope.tenantId,
    canManage: scope.canManage,
    settings,
    defaults: {
      signedInHourlyLimit: DEFAULT_SIGNED_IN_HOURLY,
      anonymousHourlyLimit: DEFAULT_ANONYMOUS_HOURLY,
      retentionDays: conversationRetentionDays(),
    },
    bounds: SETTINGS_BOUNDS,
  });
}

export async function PUT(req: NextRequest) {
  const scope = await assistantAdminScope(req.headers, req.nextUrl.searchParams.get("tenantId"), { manage: true });
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (scope.all || !scope.tenantId || !scope.canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const data = sanitizeSettingsInput(body);
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const tenant = await db.tenant.findUnique({ where: { id: scope.tenantId }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  await db.researchAssistantSettings.upsert({
    where: { tenantId: scope.tenantId },
    create: { tenantId: scope.tenantId, ...data, updatedBy: scope.session.userId },
    update: { ...data, updatedBy: scope.session.userId },
  });
  clearAssistantSettingsCache(scope.tenantId);
  await db.auditLog
    .create({
      data: {
        userId: scope.session.userId,
        action: "RESEARCH_ASSISTANT_SETTINGS",
        entityType: "TENANT",
        entityId: scope.tenantId,
        metadata: JSON.stringify({ fields: Object.keys(data) }),
      },
    })
    .catch(() => {});
  return NextResponse.json({ settings: await getAssistantSettings(scope.tenantId) });
}
