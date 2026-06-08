import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

/** One-off: swap the old arc mark for the new sun mark in the Play-store
 *  marketing graphics, and re-render their PNGs. */
const root = process.cwd();
const GREEN = "#7BAA94";
const AMBER = "#F5B52E";

function sunMark(cx: number, cy: number, r: number): string {
  const inner = r + r * 0.36, outer = r + r * 0.92, w = Math.max(2, r * 0.2);
  const fs = r * 1.5, base = cy + fs * 0.35;
  let rays = "";
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 2 * Math.PI;
    rays += `<line x1="${(cx + inner * Math.cos(a)).toFixed(1)}" y1="${(cy + inner * Math.sin(a)).toFixed(1)}" x2="${(cx + outer * Math.cos(a)).toFixed(1)}" y2="${(cy + outer * Math.sin(a)).toFixed(1)}"/>`;
  }
  return `<g stroke="${AMBER}" stroke-width="${w}" stroke-linecap="round">${rays}</g>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GREEN}"/>` +
    `<text x="${cx}" y="${base.toFixed(1)}" font-family="Manrope, Arial, sans-serif" font-size="${fs.toFixed(0)}" font-weight="800" fill="#FFFFFF" text-anchor="middle">n</text>`;
}

// feature.svg: replace the old mark inside the white logo tile (tile is 0..240).
{
  const p = join(root, "assets/marketing/feature.svg");
  let s = readFileSync(p, "utf8");
  s = s.replace(/<g transform="translate\(20 20\) scale\(2\.0\)">[\s\S]*?<\/g>\s*<\/g>/, `${sunMark(120, 120, 52)}`);
  writeFileSync(p, s);
  console.log("patched feature.svg");
}

// promo.svg: replace the green square + old mark with the sun mark (text stays).
{
  const p = join(root, "assets/marketing/promo.svg");
  let s = readFileSync(p, "utf8");
  s = s.replace(/<rect width="64" height="64" rx="16" fill="#7BAA94"\/>\s*<g transform="translate\(6 6\) scale\(0\.52\)">[\s\S]*?<\/g>\s*<\/g>/, `${sunMark(32, 32, 14)}`);
  writeFileSync(p, s);
  console.log("patched promo.svg");
}

function render(svgFile: string, pngFile: string, width: number) {
  const svg = readFileSync(join(root, svgFile), "utf8");
  writeFileSync(join(root, pngFile), new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
  console.log("rendered", pngFile);
}
render("assets/marketing/feature.svg", "public/marketing/feature-graphic.png", 1024);
render("assets/marketing/promo.svg", "public/marketing/promo.png", 1200);
