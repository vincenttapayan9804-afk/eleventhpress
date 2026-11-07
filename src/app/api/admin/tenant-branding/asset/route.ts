import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { putObject, presignGet } from "@/lib/storage";
import { validateUploadBytes } from "@/lib/uploads";
import { resolveBrandingTarget } from "@/lib/tenant-branding-admin";
import { checkRateLimit } from "@/lib/ratelimit";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * POST /api/admin/tenant-branding/asset[?tenantId=]  (multipart: file, kind=logo|favicon)
 * Uploads a logo or favicon for the branding console and returns its public
 * URL. The console then saves that URL with the rest of the branding, so an
 * upload on its own changes nothing on the live site. PNG/JPEG/WebP up to
 * 2 MB, content checked against the file's real signature.
 */
export async function POST(req: NextRequest) {
  const target = await resolveBrandingTarget(req);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const limited = await checkRateLimit(`brand-asset:${target.session.userId}`, 30, 3600);
  if (!limited.ok) return NextResponse.json({ error: "Too many uploads — try again later" }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload" }, { status: 400 });
  }
  const file = form.get("file");
  const kind = form.get("kind") === "favicon" ? "favicon" : "logo";
  if (!(file instanceof Blob)) return NextResponse.json({ error: "Choose an image to upload" }, { status: 400 });

  const contentType = file.type;
  const bytes = Buffer.from(await file.arrayBuffer());
  const check = validateUploadBytes("brand-assets", contentType, bytes);
  if (!check.ok) {
    const error =
      check.status === 400 && check.error.startsWith("Unsupported")
        ? "Use a PNG, JPG or WebP image"
        : check.error;
    return NextResponse.json({ error }, { status: check.status });
  }

  const key = `brand-assets/${target.tenant.id}/${kind}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${EXT[contentType]}`;
  await putObject(key, bytes, contentType);
  const url = await presignGet(key);
  return NextResponse.json({ url, kind });
}
