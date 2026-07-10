/** Generate the final 4 discipline images. */
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUTPUT = path.resolve(process.cwd(), "public", "disciplines");
const STYLE = "professional studio-grade 4D render, deep royal purple and pearlescent white palette, cinematic volumetric lighting, depth of field, ultra-detailed, 8k, luxury academic publishing aesthetic, dark vignette on left side for text overlay";

const FINAL: { slug: string; prompt: string }[] = [
  { slug: "education", prompt: `A graduation cap on a stack of ancient books, glowing pages, purple academic ambiance, dark library background, ${STYLE}` },
  { slug: "business", prompt: `Modern corporate glass skyscrapers at twilight, purple sky, business district, reflecting lights, professional architecture, ${STYLE}` },
  { slug: "technology", prompt: `Interlocking mechanical gears and cogs, precision engineering, purple metallic finish, dark industrial background, ${STYLE}` },
  { slug: "language-literature", prompt: `An open antique book with a glowing quill pen, magical letters floating from pages, purple ink, dark scholarly background, ${STYLE}` },
];

async function main() {
  const zai = await ZAI.create();
  for (const d of FINAL) {
    const out = path.join(OUTPUT, `${d.slug}.png`);
    if (fs.existsSync(out)) { console.log(`skip ${d.slug}`); continue; }
    try {
      const res = await zai.images.generations.create({ prompt: d.prompt, size: "1024x1024" });
      fs.writeFileSync(out, Buffer.from(res.data[0].base64, "base64"));
      console.log(`✓ ${d.slug}`);
    } catch (e: any) {
      console.error(`✗ ${d.slug}: ${e.message}`);
    }
  }
}
main().catch(console.error);
