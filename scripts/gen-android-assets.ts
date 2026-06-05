import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

/**
 * Rasterize the brand SVGs into the source PNGs that `@capacitor/assets`
 * consumes to generate Android launcher icons + splash screens.
 *
 * Run after changing the logo: `npx tsx scripts/gen-android-assets.ts`.
 * Outputs are committed so the CI Android build needs no rasterizer.
 *
 * @capacitor/assets convention (assets/):
 *   icon-only.png        1024  full icon (legacy launcher / fallback)
 *   icon-foreground.png  1024  adaptive foreground (symbol, padded)
 *   icon-background.png  1024  adaptive background (solid green)
 *   splash.png           2732  light splash
 *   splash-dark.png      2732  dark splash
 */
const root = process.cwd();

function render(svgPath: string, size: number, outName: string) {
  const svg = readFileSync(join(root, svgPath), "utf8");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } })
    .render()
    .asPng();
  writeFileSync(join(root, "assets", outName), png);
  console.log(`  ${outName} (${size}px)`);
}

console.log("Generating Android source assets…");
render("assets/icon.svg", 1024, "icon-only.png");
render("assets/icon-foreground.svg", 1024, "icon-foreground.png");
render("assets/icon-background.svg", 1024, "icon-background.png");
render("assets/splash.svg", 2732, "splash.png");
render("assets/splash-dark.svg", 2732, "splash-dark.png");
console.log("Done.");
