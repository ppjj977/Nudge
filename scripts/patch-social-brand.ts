import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

/** One-off: swap the old square-"n" wordmark for the new sun mark across the
 *  standalone social assets, refresh the TikTok avatar, and re-render covers. */
const root = process.cwd();
const GREEN = "#7BAA94";
const AMBER = "#F5B52E";
const DARK = "#3C5A4C";

function sunMark(cx: number, cy: number, r: number): string {
  const inner = r + r * 0.36;
  const outer = r + r * 0.92;
  const w = Math.max(2, r * 0.2);
  const fs = r * 1.5;
  const base = cy + fs * 0.35;
  let rays = "";
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 2 * Math.PI;
    rays += `<line x1="${(cx + inner * Math.cos(a)).toFixed(1)}" y1="${(cy + inner * Math.sin(a)).toFixed(1)}" x2="${(cx + outer * Math.cos(a)).toFixed(1)}" y2="${(cy + outer * Math.sin(a)).toFixed(1)}"/>`;
  }
  return (
    `<g stroke="${AMBER}" stroke-width="${w}" stroke-linecap="round">${rays}</g>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GREEN}"/>` +
    `<text x="${cx}" y="${base.toFixed(1)}" font-family="Manrope, Arial, sans-serif" font-size="${fs.toFixed(0)}" font-weight="800" fill="#FFFFFF" text-anchor="middle">n</text>`
  );
}

// Replace the old wordmark (green rect + "n" + "nudge") with the sun mark.
const RE =
  /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" rx="\d+" fill="#7BAA94"\/>\s*<text x="\d+" y="\d+"[^>]*>n<\/text>\s*<text x="(\d+)" y="(\d+)"([^>]*)>nudge<\/text>/;

function patch(file: string) {
  const p = join(root, file);
  let s = readFileSync(p, "utf8");
  const m = s.match(RE);
  if (!m) {
    console.log("  (no wordmark match)", file);
    return;
  }
  const rx = +m[1], ry = +m[2], rw = +m[3], rh = +m[4];
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const r = rw * 0.36;
  const nudgeAttrs = m[7];
  const nudgeX = (cx + r * 1.92 + 14).toFixed(0);
  const nudgeY = (cy + r * 0.45).toFixed(0);
  const replacement = `${sunMark(cx, cy, r)}\n  <text x="${nudgeX}" y="${nudgeY}"${nudgeAttrs}>nudge</text>`;
  s = s.replace(RE, replacement);
  writeFileSync(p, s);
  console.log("  patched", file);
}

["public/social/day01-school-letter.svg", "public/social/day01-cover.svg",
 "public/social/demo-school-email.svg", "public/social/demo-school-email-cover.svg"].forEach(patch);

// Re-render the covers that have PNGs.
function render(svgFile: string, pngFile: string, width = 1080) {
  const svg = readFileSync(join(root, svgFile), "utf8");
  writeFileSync(join(root, pngFile), new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
  console.log("  rendered", pngFile);
}
render("public/social/day01-cover.svg", "public/social/day01-cover.png");
render("public/social/demo-school-email-cover.svg", "public/social/demo-school-email-cover.png");

// TikTok avatar: sun mark on the dark-green tile (circle-safe).
const avatar = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720" width="720" height="720">` +
  `<rect width="720" height="720" fill="${DARK}"/>${sunMark(360, 360, 120)}</svg>`;
writeFileSync(join(root, "public/social/tiktok-avatar.svg"), avatar);
writeFileSync(join(root, "public/social/tiktok-avatar.png"), new Resvg(avatar, { fitTo: { mode: "width", value: 720 } }).render().asPng());
console.log("  avatar refreshed");
