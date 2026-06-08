import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

/**
 * Generate the brand assets from one source-of-truth mark: a green circle with
 * a white "n", inside an amber sun-burst of rays. Writes the icon SVGs (used by
 * @capacitor/assets for Android) + their PNG siblings, then the public/ web
 * icons. Run after a logo change: `npx tsx scripts/gen-brand.ts`.
 */
const root = process.cwd();
const GREEN = "#7BAA94";
const AMBER = "#F5B52E";
const DARK = "#3C5A4C";
const WHITE = "#FFFFFF";
const BG = "#F8F7F4";

/** Amber sun rays around (cx,cy). */
function rays(cx: number, cy: number, inner: number, outer: number, w: number, n = 16): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const x1 = (cx + inner * Math.cos(a)).toFixed(2);
    const y1 = (cy + inner * Math.sin(a)).toFixed(2);
    const x2 = (cx + outer * Math.cos(a)).toFixed(2);
    const y2 = (cy + outer * Math.sin(a)).toFixed(2);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }
  return `<g stroke="${AMBER}" stroke-width="${w}" stroke-linecap="round">${s}</g>`;
}

/** The full mark (rays + green disc + white n) centred at (cx,cy), disc radius r. */
function mark(cx: number, cy: number, r: number): string {
  const inner = r + r * 0.36;
  const outer = r + r * 0.92;
  const w = Math.max(2, r * 0.2);
  const fs = r * 1.5;
  const baseline = cy + fs * 0.35;
  return (
    rays(cx, cy, inner, outer, w) +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GREEN}"/>` +
    `<text x="${cx}" y="${baseline.toFixed(2)}" font-family="Manrope, Arial, sans-serif" ` +
    `font-size="${fs.toFixed(1)}" font-weight="800" fill="${WHITE}" text-anchor="middle">n</text>`
  );
}

const wrap = (inner: string, vb = 100) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" width="${vb}" height="${vb}">${inner}</svg>`;

// Source SVGs --------------------------------------------------------------
const iconSvg = wrap(mark(50, 50, 20)); // transparent, mark fills frame
const foregroundSvg = wrap(mark(50, 50, 16)); // adaptive safe zone (padded)
const backgroundSvg = wrap(`<rect width="100" height="100" fill="${DARK}"/>`);
const maskableSvg = wrap(`<rect width="100" height="100" fill="${DARK}"/>` + mark(50, 50, 18));

writeFileSync(join(root, "assets/icon.svg"), iconSvg);
writeFileSync(join(root, "assets/icon-foreground.svg"), foregroundSvg);
writeFileSync(join(root, "assets/icon-background.svg"), backgroundSvg);
writeFileSync(join(root, "assets/icon-maskable.svg"), maskableSvg);

// Splash screens -----------------------------------------------------------
function splash(bg: string, markFill: "light" | "dark"): string {
  const m = markFill === "light" ? mark(512, 470, 90) : mark(512, 470, 90);
  const word = markFill === "light" ? GREEN : "#FFFFFF";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">` +
    `<rect width="1024" height="1024" fill="${bg}"/>${m}` +
    `<text x="512" y="660" font-family="Manrope, Arial, sans-serif" font-size="120" font-weight="800" fill="${word}" text-anchor="middle">nudge</text></svg>`;
}
writeFileSync(join(root, "assets/splash.svg"), splash(BG, "light"));
writeFileSync(join(root, "assets/splash-dark.svg"), splash(DARK, "dark"));

// PNG siblings (@capacitor/assets + committed copies) ----------------------
function png(svg: string, size: number, out: string) {
  const buf = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(join(root, out), buf);
}
png(iconSvg, 1024, "assets/icon-only.png");
png(foregroundSvg, 1024, "assets/icon-foreground.png");
png(backgroundSvg, 1024, "assets/icon-background.png");
png(splash(BG, "light"), 2048, "assets/splash.png");
png(splash(DARK, "dark"), 2048, "assets/splash-dark.png");

console.log("brand assets written → assets/. Now run: npx tsx scripts/gen-icons.ts");
