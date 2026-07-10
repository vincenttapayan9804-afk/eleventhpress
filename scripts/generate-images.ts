/**
 * Generate professional studio-grade 4D images for:
 *   - Hero section background
 *   - 12 discipline card backgrounds
 *
 * "4D" here = 3D-rendered depth + cinematic time-of-day lighting,
 * giving each image a living, dimensional quality.
 */
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUTPUT_HERO = path.resolve(process.cwd(), "public", "hero");
const OUTPUT_DISC = path.resolve(process.cwd(), "public", "disciplines");

const STYLE_SUFFIX =
  "professional studio-grade 4D render, deep royal purple and pearlescent white palette, cinematic volumetric lighting, depth of field, ultra-detailed, 8k, luxury academic publishing aesthetic, dark vignette on left side for text overlay";

const HERO_PROMPT = `A majestic abstract spherical knowledge globe floating in dark royal purple cosmic space, glowing latitude and longitude lines, illuminated research node points across the surface like a world map of science, orbital particle rings, soft purple halo glow, pearlescent mist, ${STYLE_SUFFIX}`;

const DISCIPLINES: { name: string; slug: string; prompt: string }[] = [
  {
    name: "Physics",
    slug: "physics",
    prompt: `A luminous atom model with glowing electron orbits, central nucleus radiating energy, quantum particle trails, dark purple background, ${STYLE_SUFFIX}`,
  },
  {
    name: "Biology",
    slug: "biology",
    prompt: `A rotating DNA double helix made of glowing purple glass, bio-luminescent nucleotide pairs, dark laboratory bokeh background, ${STYLE_SUFFIX}`,
  },
  {
    name: "Computer Science",
    slug: "computer-science",
    prompt: `A glowing microchip circuit board with luminous traces, data flowing through pathways, purple PCB, dark tech background, ${STYLE_SUFFIX}`,
  },
  {
    name: "Sociology",
    slug: "sociology",
    prompt: `An abstract network of glowing human figure silhouettes connected by light threads, social network visualization, dark purple gradient, ${STYLE_SUFFIX}`,
  },
  {
    name: "Economics",
    slug: "economics",
    prompt: `A 3D bar chart and rising stock graph made of purple glass, financial data visualization, dark gradient background, ${STYLE_SUFFIX}`,
  },
  {
    name: "Psychology",
    slug: "psychology",
    prompt: `An abstract glowing human brain with neural network connections sparking, synapses firing, dark purple background, ${STYLE_SUFFIX}`,
  },
  {
    name: "Environmental Science",
    slug: "environmental-science",
    prompt: `A majestic earth globe with glowing green and purple biosphere, swirling clouds, natural world, dark space background, ${STYLE_SUFFIX}`,
  },
  {
    name: "Mathematics",
    slug: "mathematics",
    prompt: `Floating geometric polyhedra, icosahedron and dodecahedron, mathematical equations glowing in space, purple wireframe, dark background, ${STYLE_SUFFIX}`,
  },
  {
    name: "Education",
    slug: "education",
    prompt: `A graduation cap on a stack of ancient books, glowing pages, purple academic ambiance, dark library background, ${STYLE_SUFFIX}`,
  },
  {
    name: "Business",
    slug: "business",
    prompt: `Modern corporate glass skyscrapers at twilight, purple sky, business district, reflecting lights, professional architecture, ${STYLE_SUFFIX}`,
  },
  {
    name: "Technology",
    slug: "technology",
    prompt: `Interlocking mechanical gears and cogs, precision engineering, purple metallic finish, dark industrial background, ${STYLE_SUFFIX}`,
  },
  {
    name: "Language and Literature",
    slug: "language-literature",
    prompt: `An open antique book with a glowing quill pen, magical letters floating from pages, purple ink, dark scholarly background, ${STYLE_SUFFIX}`,
  },
];

async function generateOne(zai: any, prompt: string, size: string, outputPath: string) {
  const res = await zai.images.generations.create({ prompt, size });
  const b64 = res.data[0].base64;
  fs.writeFileSync(outputPath, Buffer.from(b64, "base64"));
  console.log(`  ✓ ${path.basename(outputPath)} (${size})`);
}

async function main() {
  fs.mkdirSync(OUTPUT_HERO, { recursive: true });
  fs.mkdirSync(OUTPUT_DISC, { recursive: true });

  const zai = await ZAI.create();

  console.log("Generating hero background (1440x768)...");
  await generateOne(zai, HERO_PROMPT, "1440x768", path.join(OUTPUT_HERO, "hero-bg.png"));

  console.log("Generating 12 discipline images (1024x1024)...");
  for (const d of DISCIPLINES) {
    await generateOne(zai, d.prompt, "1024x1024", path.join(OUTPUT_DISC, `${d.slug}.png`));
  }

  console.log("All images generated.");
}

main().catch((e) => { console.error(e); process.exit(1); });
