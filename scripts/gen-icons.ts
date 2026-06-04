import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

/**
 * Rasterize the brand SVGs (assets/) into the PNG app icons in public/.
 * Run once after changing the logo: `npx tsx scripts/gen-icons.ts`.
 * The generated PNGs are committed, so production builds need no rasterizer.
 */
const root = process.cwd();

function render(svgPath: string, size: number, outName: string) {
  const svg = readFileSync(join(root, svgPath), "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
  });
  const png = resvg.render().asPng();
  writeFileSync(join(root, "public", outName), png);
  console.log(`  ${outName} (${size}px)`);
}

console.log("Generating icons…");
render("assets/icon.svg", 192, "icon-192.png");
render("assets/icon.svg", 512, "icon-512.png");
render("assets/icon-maskable.svg", 512, "icon-maskable-512.png");
render("assets/icon-maskable.svg", 180, "apple-touch-icon.png");
render("assets/icon.svg", 32, "favicon-32.png");
console.log("Done.");
