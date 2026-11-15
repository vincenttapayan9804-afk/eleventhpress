// Regenerates src/lib/study-guide/template.generated.ts from template.html.
// Run after editing the template: node scripts/gen-study-guide-template.mjs
// (src/lib/study-guide/study-guide.test.ts fails if the two drift apart.)
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync(new URL("../src/lib/study-guide/template.html", import.meta.url), "utf-8");
const out = `// GENERATED from template.html by scripts/gen-study-guide-template.mjs — do not edit by hand.
export const STUDY_GUIDE_TEMPLATE: string = ${JSON.stringify(html)};
`;
writeFileSync(new URL("../src/lib/study-guide/template.generated.ts", import.meta.url), out);
console.log(`template.generated.ts written (${html.length} chars)`);
