import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Social-share image (1200×630) shared by articles, author profiles and the
 * site default: a typographic card in the press's royal palette — eyebrow,
 * title, byline and a footer line — with no stock art or decorative icons.
 */
export const OG_SIZE = { width: 1200, height: 630 };

// The site's own typefaces: Fraunces for titles, Inter for supporting text.
let fontsPromise: Promise<{ name: string; data: Buffer; weight: 500 | 600; style: "normal" }[]> | null = null;
function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/Fraunces-SemiBold.ttf")).then((data) => ({ name: "Fraunces", data, weight: 600 as const, style: "normal" as const })),
    readFile(join(process.cwd(), "src/assets/fonts/Inter-Medium.ttf")).then((data) => ({ name: "Inter", data, weight: 500 as const, style: "normal" as const })),
  ]).catch(() => []);
  return fontsPromise;
}

export async function ogCard({
  eyebrow,
  title,
  byline,
  footer,
  brand = "Eleventh Press",
}: {
  eyebrow: string;
  title: string;
  byline?: string;
  footer?: string;
  brand?: string;
}) {
  const t = title.trim();
  const size = t.length > 140 ? 44 : t.length > 90 ? 52 : t.length > 50 ? 62 : 72;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #1d0b33 0%, #3b1466 55%, #5b2a96 100%)",
          color: "#ffffff",
          fontFamily: "Fraunces",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 4, background: "#c9a7ff" }} />
          <div style={{ fontSize: 24, letterSpacing: 6, textTransform: "uppercase", color: "#d9c4ff", fontFamily: "Inter" }}>{eyebrow.slice(0, 60)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: size, lineHeight: 1.12, fontWeight: 600, maxWidth: 1050, display: "flex" }}>{t.length > 200 ? `${t.slice(0, 197)}…` : t}</div>
          {byline && <div style={{ fontSize: 28, color: "#e7dcff", fontFamily: "Inter", display: "flex" }}>{byline.slice(0, 110)}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontFamily: "Inter" }}>
          <div style={{ fontSize: 22, color: "#cbb8ef", display: "flex" }}>{(footer || "").slice(0, 90)}</div>
          <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: 4, textTransform: "uppercase", display: "flex" }}>{brand.slice(0, 40)}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadFonts() }
  );
}
