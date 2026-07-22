/** Generate remaining discipline images in parallel batches of 4. */
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUTPUT = path.resolve(process.cwd(), "public", "disciplines");

const STYLE = "professional studio-grade 4D render, deep royal purple and pearlescent white palette, cinematic volumetric lighting, depth of field, ultra-detailed, 8k, luxury academic publishing aesthetic, dark vignette on left side for text overlay";

const REMAINING: { slug: string; prompt: string }[] = [
  { slug: "computer-science", prompt: `A glowing microchip circuit board with luminous traces, data flowing through pathways, purple PCB, dark tech background, ${STYLE}` },
  { slug: "sociology", prompt: `An abstract network of glowing human figure silhouettes connected by light threads, social network visualization, dark purple gradient, ${STYLE}` },
  { slug: "economics", prompt: `A 3D bar chart and rising stock graph made of purple glass, financial data visualization, dark gradient background, ${STYLE}` },
  { slug: "psychology", prompt: `An abstract glowing human brain with neural network connections sparking, synapses firing, dark purple background, ${STYLE}` },
  { slug: "environmental-science", prompt: `A majestic earth globe with glowing green and purple biosphere, swirling clouds, natural world, dark space background, ${STYLE}` },
  { slug: "mathematics", prompt: `Floating geometric polyhedra, icosahedron and dodecahedron, mathematical equations glowing in space, purple wireframe, dark background, ${STYLE}` },
  { slug: "education", prompt: `A graduation cap on a stack of ancient books, glowing pages, purple academic ambiance, dark library background, ${STYLE}` },
  { slug: "business", prompt: `Modern corporate glass skyscrapers at twilight, purple sky, business district, reflecting lights, professional architecture, ${STYLE}` },
  { slug: "technology", prompt: `Interlocking mechanical gears and cogs, precision engineering, purple metallic finish, dark industrial background, ${STYLE}` },
  { slug: "language-literature", prompt: `An open antique book with a glowing quill pen, magical letters floating from pages, purple ink, dark scholarly background, ${STYLE}` },
];

async function genOne(zai: any, slug: string, prompt: string) {
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- `slug` is always one of the hardcoded literals in the REMAINING array above, never external/user input; this is a one-off local dev script, not part of the runtime request path.
  const out = path.join(OUTPUT, `${slug}.png`);
  if (fs.existsSync(out)) { console.log(`  skip ${slug} (exists)`); return; }
  try {
    const res = await zai.images.generations.create({ prompt, size: "1024x1024" });
    fs.writeFileSync(out, Buffer.from(res.data[0].base64, "base64"));
    console.log(`  ✓ ${slug}`);
  } catch (e: any) {
    console.error(`  ✗ ${slug}: ${e.message}`);
  }
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const zai = await ZAI.create();
  // Process in batches of 4
  for (let i = 0; i < REMAINING.length; i += 4) {
    const batch = REMAINING.slice(i, i + 4);
    console.log(`Batch ${i / 4 + 1}...`);
    await Promise.all(batch.map((d) => genOne(zai, d.slug, d.prompt)));
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
