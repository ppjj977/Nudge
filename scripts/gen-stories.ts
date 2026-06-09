import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

/**
 * Branded 9:16 Story templates (1080×1920). Stories carry the interactive
 * stickers + the clickable link, so these frames give the native poll /
 * question / countdown / slider a tidy, on-brand home instead of a bare sticker
 * on a blank screen. A dashed "drop your sticker here" zone keeps the native
 * sticker off the brand + link. Run: npx tsx scripts/gen-stories.ts
 */
const C = {
  green: "#7BAA94",
  amber: "#F5B52E",
  navy: "#232A32",
  navyDk: "#161B21",
  mint: "#CFE0D5",
  cream: "#ECE6D6",
  bg: "#F8F7F4",
  white: "#FFFFFF",
  muted: "#667085",
};

function leafPath(x: number, y: number, s: number): string {
  const r = s / 2;
  return (
    `M ${x} ${y} L ${x + r} ${y} A ${r} ${r} 0 0 1 ${x + s} ${y + r} ` +
    `L ${x + s} ${y + s} L ${x + r} ${y + s} A ${r} ${r} 0 0 1 ${x} ${y + r} Z`
  );
}
/** Leaf + "nudge" wordmark centred at the top, tinted for the background. */
function wordmark(ink: string): string {
  const k = 0.5; // 100-box → ~50px
  const tx = 470 - 50 * k,
    ty = 70 - 50 * k;
  const mark =
    `<path d="${leafPath(16, 16, 68)}" fill="none" stroke="${C.green}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<text x="45" y="64" font-size="44" font-weight="700" fill="${ink}" text-anchor="middle">n</text>` +
    `<circle cx="64" cy="59" r="5.5" fill="${C.amber}"/>`;
  return (
    `<g transform="translate(${tx},${ty}) scale(${k})">${mark}</g>` +
    `<text x="500" y="108" font-size="40" font-weight="800" fill="${ink}">nudge</text>`
  );
}

type Tone = { bg: string; ink: string; sub: string; accent: string; dark: boolean };
const tones: Record<string, Tone> = {
  navy: { bg: C.navy, ink: C.cream, sub: "#AEB6BE", accent: C.amber, dark: true },
  light: { bg: C.bg, ink: C.navy, sub: C.muted, accent: C.green, dark: false },
  mint: { bg: C.mint, ink: C.navy, sub: "#46584E", accent: C.navy, dark: false },
  dark: { bg: C.navyDk, ink: C.cream, sub: "#AEB6BE", accent: C.amber, dark: true },
};

/** Dashed zone telling the user where to place the native sticker. */
function stickerZone(label: string, accent: string, y = 720, h = 560): string {
  return (
    `<rect x="150" y="${y}" width="780" height="${h}" rx="36" fill="none" stroke="${accent}" stroke-width="4" stroke-dasharray="16 16" opacity="0.7"/>` +
    `<text x="540" y="${y + h / 2 + 10}" font-size="34" font-weight="700" fill="${accent}" text-anchor="middle" opacity="0.85">${label}</text>`
  );
}

/** Bottom reminder to add the native link sticker. */
function linkHint(t: Tone): string {
  const fill = t.dark ? t.accent : C.navy;
  const ink = t.dark ? C.navy : C.cream;
  return (
    `<rect x="260" y="1700" width="560" height="92" rx="46" fill="${fill}"/>` +
    `<text x="540" y="1758" font-size="34" font-weight="800" fill="${ink}" text-anchor="middle">nudgelive.co.uk</text>` +
    `<text x="540" y="1648" font-size="26" font-weight="700" fill="${t.sub}" text-anchor="middle">add the link sticker ↓</text>`
  );
}

function frame(inner: string, t: Tone): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920" font-family="Inter, Arial, sans-serif">
  <rect width="1080" height="1920" fill="${t.bg}"/>
  ${wordmark(t.ink)}
  ${inner}
  ${linkHint(t)}
</svg>`;
}

function headline(lines: string[], t: Tone, y = 360, size = 64): string {
  return lines
    .map((l, i) => `<text x="540" y="${y + i * (size + 14)}" font-size="${size}" font-weight="800" fill="${t.ink}" text-anchor="middle">${l}</text>`)
    .join("\n  ");
}

/* ------------------------------- templates -------------------------------- */
const out = join(process.cwd(), "public", "social");
mkdirSync(out, { recursive: true });

const templates: Record<string, string> = {
  // Flexible interactive frame, three backgrounds for day-to-day variety.
  "story-poll": frame(
    headline(["Which do you", "forget more?"], tones.navy) + stickerZone("↑ drop your POLL sticker here", tones.navy.accent),
    tones.navy,
  ),
  "story-question": frame(
    headline(["What's the ONE thing", "you always forget?"], tones.light, 340, 56) +
      stickerZone("↑ drop your QUESTION sticker here", tones.light.accent),
    tones.light,
  ),
  "story-slider": frame(
    headline(["How many unread", "screenshots? 😬"], tones.mint, 340, 56).replace(" 😬", "") +
      stickerZone("↑ drop your EMOJI SLIDER here", tones.mint.accent),
    tones.mint,
  ),
  // Promo urgency — countdown + spots.
  "story-countdown": frame(
    headline(["nudge opens", "soon."], tones.dark) + stickerZone("↑ pin your COUNTDOWN sticker here", tones.dark.accent),
    tones.dark,
  ),
  "story-spots": frame(
    `<circle cx="540" cy="780" r="200" fill="${C.amber}"/>` +
      `<text x="540" y="745" font-size="120" font-weight="800" fill="${C.navy}" text-anchor="middle">[N]</text>` +
      `<text x="540" y="835" font-size="36" font-weight="800" fill="${C.navy}" text-anchor="middle">/ 10 left</text>` +
      headline(["free-for-life spots left"], tones.dark, 1120, 48) +
      `<text x="540" y="1200" font-size="34" font-weight="700" fill="${tones.dark.sub}" text-anchor="middle">first 10 to register = Pro free forever</text>`,
    tones.dark,
  ),
};

for (const [name, svg] of Object.entries(templates)) {
  writeFileSync(join(out, `${name}.svg`), svg);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } }).render().asPng();
  writeFileSync(join(out, `${name}.png`), png);
  console.log("  rendered", name);
}
console.log("Done → public/social/ (story templates)");
