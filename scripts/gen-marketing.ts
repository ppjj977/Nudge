import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

/**
 * Rasterize the marketing SVGs into PNGs for the Play listing & socials.
 * Run: npx tsx scripts/gen-marketing.ts
 *   feature-graphic.png  1024×500  (Play Store feature graphic)
 *   promo.png            1200×630  (social / Open Graph card)
 */
const root = process.cwd();
const outDir = join(root, "public", "marketing");
mkdirSync(outDir, { recursive: true });

function render(svgPath: string, width: number, outName: string) {
  const svg = readFileSync(join(root, svgPath), "utf8");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width } })
    .render()
    .asPng();
  writeFileSync(join(outDir, outName), png);
  console.log(`  ${outName} (${width}px wide)`);
}

console.log("Generating marketing graphics…");
render("assets/marketing/feature.svg", 1024, "feature-graphic.png");
render("assets/marketing/promo.svg", 1200, "promo.png");
console.log("Done → public/marketing/");
