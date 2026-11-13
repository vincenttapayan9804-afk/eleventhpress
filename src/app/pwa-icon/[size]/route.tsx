import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { hexOr } from "@/lib/publisher-identity";

/** Two-letter monogram for a tenant without a logo ("Ron Publishing" → "RP"). */
function monogram(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const letters = (words.length > 1 ? words.slice(0, 2).map((w) => w[0]) : [...(words[0] ?? "J").slice(0, 2)]).join("");
  return letters.toUpperCase() || "J";
}

/**
 * App icons for the web app manifest, 180/192/512 px (maskable-safe).
 *
 * The platform keeps its wax-seal "EP" monogram. A whitelabel tenant's
 * manifest asks for `?t=<slug>` (see src/app/manifest.ts) and gets its own
 * icon: its logo on a white tile, or its initials in its brand colour —
 * never the Eleventh Press seal. The slug is part of the URL, so each
 * tenant's icon is cached separately.
 */
export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "512" ? 512 : size === "180" ? 180 : 192;
  const fraunces = await readFile(join(process.cwd(), "src/assets/fonts/Fraunces-SemiBold.ttf")).catch(() => null);
  const fonts = fraunces ? [{ name: "Fraunces", data: fraunces, weight: 600 as const, style: "normal" as const }] : [];

  const slug = new URL(req.url).searchParams.get("t");
  const tenant = slug
    ? await db.tenant
        .findUnique({ where: { slug }, select: { name: true, siteName: true, logoUrl: true, primaryColor: true, accentColor: true, isPlatform: true } })
        .catch(() => null)
    : null;

  if (tenant && !tenant.isPlatform) {
    const name = tenant.siteName || tenant.name;
    const primary = hexOr(tenant.primaryColor, "#3b1466");
    const accent = hexOr(tenant.accentColor, "#ffffff");
    const logo = tenant.logoUrl && /^https?:\/\//i.test(tenant.logoUrl) && !/\.svg(\?|$)/i.test(tenant.logoUrl) ? tenant.logoUrl : null;
    return new ImageResponse(
      logo ? (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
          <img src={logo} alt="" width={Math.round(px * 0.7)} height={Math.round(px * 0.7)} style={{ objectFit: "contain" }} />
        </div>
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: primary }}>
          <div
            style={{
              width: px * 0.68,
              height: px * 0.68,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `${Math.round(px * 0.025)}px solid ${accent}`,
              color: accent,
              fontSize: px * 0.27,
              fontWeight: 700,
              fontFamily: fraunces ? "Fraunces" : "serif",
            }}
          >
            {monogram(name)}
          </div>
        </div>
      ),
      { width: px, height: px, fonts, headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } }
    );
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2a0f4a" }}>
        <div
          style={{
            width: px * 0.68,
            height: px * 0.68,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at 35% 30%, #7a45c2, #3b1466 70%)",
            border: `${Math.round(px * 0.025)}px solid #d6b56d`,
            color: "#e9cf8f",
            fontSize: px * 0.27,
            fontWeight: 700,
            fontFamily: fraunces ? "Fraunces" : "serif",
            letterSpacing: px * 0.005,
          }}
        >
          EP
        </div>
      </div>
    ),
    { width: px, height: px, fonts, headers: { "Cache-Control": "public, max-age=604800, immutable" } }
  );
}
