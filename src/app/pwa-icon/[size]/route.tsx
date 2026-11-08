import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** App icons for the web app manifest: the press's wax-seal monogram, 192/512 px (maskable-safe). */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "512" ? 512 : size === "180" ? 180 : 192;
  const fraunces = await readFile(join(process.cwd(), "src/assets/fonts/Fraunces-SemiBold.ttf")).catch(() => null);
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
    { width: px, height: px, fonts: fraunces ? [{ name: "Fraunces", data: fraunces, weight: 600, style: "normal" }] : [], headers: { "Cache-Control": "public, max-age=604800, immutable" } }
  );
}
