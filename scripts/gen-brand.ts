import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

/**
 * Brand assets from the official mark (Brand Guidelines v1.0): a green leaf /
 * speech-bubble outline holding a cream "n" with an amber "nudge" dot, on navy.
 * Run after a logo change: `npx tsx scripts/gen-brand.ts` then gen-icons.ts.
 */
const root = process.cwd();
const GREEN = "#7BAA94";
const AMBER = "#F5B52E";
const NAVY = "#232A32";
const NAVY_TILE = "#161B21";
const CREAM = "#ECE6D6";
const BG = "#F8F7F4";

/** Leaf/speech-bubble: square with two opposite corners pointed, two rounded. */
function leafPath(x: number, y: number, s: number): string {
  const r = s / 2;
  return (
    `M ${x} ${y} L ${x + r} ${y} A ${r} ${r} 0 0 1 ${x + s} ${y + r} ` +
    `L ${x + s} ${y + s} L ${x + r} ${y + s} A ${r} ${r} 0 0 1 ${x} ${y + r} Z`
  );
}

/**
 * The mark in a 100×100 box. `nColor` is the letter colour (navy on light,
 * cream on dark). Stroke width + glyph scale tuned to the official artwork.
 */
function mark(nColor: string, inset = 16, stroke = 8): string {
  const s = 100 - inset * 2;
  const leaf = `<path d="${leafPath(inset, inset, s)}" fill="none" stroke="${GREEN}" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const n = `<text x="45" y="64" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="700" fill="${nColor}" text-anchor="middle">n</text>`;
  const dot = `<circle cx="64" cy="59" r="5.5" fill="${AMBER}"/>`;
  return leaf + n + dot;
}

const svg = (inner: string, vb = 100) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" width="${vb}" height="${vb}">${inner}</svg>`;

// Tile (rounded navy square) + the mark, for icons.
const tile = (bg: string, m: string) =>
  svg(`<rect width="100" height="100" rx="22" fill="${bg}"/>${m}`);

const iconSvg = tile(NAVY_TILE, mark(CREAM)); // favicon / PWA / app icon
const maskableSvg = svg(`<rect width="100" height="100" fill="${NAVY_TILE}"/>` + mark(CREAM, 22, 7));
const foregroundSvg = svg(mark(CREAM, 24, 7)); // adaptive fg (transparent)
const backgroundSvg = svg(`<rect width="100" height="100" fill="${NAVY_TILE}"/>`);

writeFileSync(join(root, "assets/icon.svg"), iconSvg);
writeFileSync(join(root, "assets/icon-maskable.svg"), maskableSvg);
writeFileSync(join(root, "assets/icon-foreground.svg"), foregroundSvg);
writeFileSync(join(root, "assets/icon-background.svg"), backgroundSvg);

// Splash: navy bg, centred mark + cream wordmark (1024²).
function splashSvg(): string {
  const m = `<g transform="translate(312,200) scale(4)">${mark(CREAM)}</g>`; // 100→400px, centred-ish
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">` +
    `<rect width="1024" height="1024" fill="${NAVY}"/>${m}` +
    `<text x="512" y="720" font-family="Inter, Arial, sans-serif" font-size="120" font-weight="700" fill="${CREAM}" text-anchor="middle">nudge</text></svg>`;
}
writeFileSync(join(root, "assets/splash.svg"), splashSvg());
writeFileSync(join(root, "assets/splash-dark.svg"), splashSvg());

// PNG siblings for @capacitor/assets + committed copies.
function png(s: string, size: number, out: string) {
  writeFileSync(join(root, out), new Resvg(s, { fitTo: { mode: "width", value: size } }).render().asPng());
}
png(iconSvg, 1024, "assets/icon-only.png");
png(foregroundSvg, 1024, "assets/icon-foreground.png");
png(backgroundSvg, 1024, "assets/icon-background.png");
png(splashSvg(), 2048, "assets/splash.png");
png(splashSvg(), 2048, "assets/splash-dark.png");

console.log("brand assets written. Now: npx tsx scripts/gen-icons.ts");
