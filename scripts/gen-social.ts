/**
 * Generate Nudge social assets (TikTok/Reels + Facebook) from a content table.
 * Each day yields:
 *   public/social/dayNN-<slug>.svg   animated 9:16 clip (loops 14s) to screen-record
 *   public/social/dayNN-cover.png    static 1080×1920 cover (emoji-free, crisp)
 *
 * Run: npx tsx scripts/gen-social.ts
 *
 * The animated SVGs keep emoji (they render on-device when you record them).
 * The cover PNGs are rasterised with resvg, which has no emoji font, so covers
 * are authored emoji-free and task emoji are dropped.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const C = {
  bg: "#F8F7F4",
  text: "#232A32",
  green: "#7BAA94",
  greenDk: "#3C5A4C",
  greenTint: "#EDF2EF",
  amber: "#E8A24A",
  muted: "#667085",
  faint: "#9AA4AE",
  white: "#FFFFFF",
  border: "#E9E9E3",
  navy: "#232A32",
  mint: "#9FD3BD",
};

interface Task {
  emoji: string; // animated only
  title: string;
  sub: string;
  chip: string;
  chipFill: string;
}
interface Day {
  n: number;
  slug: string;
  hook: string[]; // emoji-free headline lines
  input: { title: string; lines: string[]; hint?: string };
  header: string; // animated scene-2 header (may have emoji)
  transition: string; // cover transition label (emoji-free)
  tasks: Task[];
  footnote: [string, string];
}

/** Turn **bold** markers into tspans. Input is otherwise plain text. */
function rich(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, '<tspan font-weight="800">$1</tspan>');
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const AMBER = "#F5B52E";
/** Leaf/speech-bubble: square with two opposite corners pointed, two rounded. */
function leafPath(x: number, y: number, s: number): string {
  const r = s / 2;
  return (
    `M ${x} ${y} L ${x + r} ${y} A ${r} ${r} 0 0 1 ${x + s} ${y + r} ` +
    `L ${x + s} ${y + s} L ${x + r} ${y + s} A ${r} ${r} 0 0 1 ${x} ${y + r} Z`
  );
}

/**
 * The leaf mark (green outline + "n" + amber dot) centred at (cx,cy). `r` keeps
 * the old sun-mark call sites' footprint; nColor is navy on light, cream on dark.
 */
function leafMark(cx: number, cy: number, r: number, nColor = C.text): string {
  const k = r * 0.0384; // 100-box → old sun footprint
  const tx = cx - 50 * k;
  const ty = cy - 50 * k;
  const inner =
    `<path d="${leafPath(16, 16, 68)}" fill="none" stroke="${C.green}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<text x="45" y="64" font-size="44" font-weight="700" fill="${nColor}" text-anchor="middle">n</text>` +
    `<circle cx="64" cy="59" r="5.5" fill="${AMBER}"/>`;
  return `<g transform="translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${k.toFixed(3)})">${inner}</g>`;
}

const WORDMARK = `
  ${leafMark(452, 100, 24)}
  <text x="520" y="118" font-size="38" font-weight="800" fill="${C.text}">nudge</text>`;

/* Shared promo scene (animated) + strip (cover). */
const PROMO_SCENE = `
  <g opacity="0">
    <animate attributeName="opacity" values="0;0;1;1;1" keyTimes="0;0.785;0.82;0.99;1" dur="14s" repeatCount="indefinite"/>
    <text x="540" y="560" font-size="52" font-weight="800" fill="${C.text}" text-anchor="middle">Stop holding it all</text>
    <text x="540" y="628" font-size="52" font-weight="800" fill="${C.text}" text-anchor="middle">in your head.</text>
    <rect x="110" y="760" width="860" height="420" rx="28" fill="${C.white}" stroke="${C.green}" stroke-width="3"/>
    <text x="540" y="860" font-size="64" text-anchor="middle">🎁</text>
    <text x="540" y="952" font-size="44" font-weight="800" fill="${C.text}" text-anchor="middle">First 10 to register</text>
    <text x="540" y="1014" font-size="44" font-weight="800" fill="${C.text}" text-anchor="middle">interest get Nudge Pro</text>
    <text x="540" y="1090" font-size="50" font-weight="800" fill="${C.green}" text-anchor="middle">FREE for life</text>
    <text x="540" y="1320" font-size="40" font-weight="800" fill="${C.text}" text-anchor="middle">nudgelive.co.uk</text>
    <g>
      <rect x="360" y="1380" width="360" height="86" rx="43" fill="${C.green}"/>
      <text x="540" y="1436" font-size="34" font-weight="800" fill="${C.white}" text-anchor="middle">Link in bio 👆</text>
      <animate attributeName="opacity" values="0.55;1;0.55" dur="1.4s" repeatCount="indefinite"/>
    </g>
    <text x="540" y="1560" font-size="28" fill="${C.faint}" text-anchor="middle">📱 Coming soon to Google Play</text>
  </g>`;

/* ---- per-day cover styling + concept motifs (bold, varied, on-brand) ---- */
const CREAM = "#ECE6D6";
const NAVY_DK = "#161B21";
type CStyle = { bg: string; ink: string; sub: string; accent: string; dark: boolean };
function coverStyle(slug: string): CStyle {
  const map: Record<string, CStyle> = {
    "brain-forgets": { bg: C.bg, ink: C.text, sub: C.muted, accent: C.green, dark: false },
    "screenshot-graveyard": { bg: C.navy, ink: CREAM, sub: "#AEB6BE", accent: C.amber, dark: true },
    "free-trial": { bg: C.navy, ink: CREAM, sub: "#AEB6BE", accent: C.amber, dark: true },
    "mental-load": { bg: C.mint, ink: C.navy, sub: "#46584E", accent: C.greenDk, dark: false },
    promo: { bg: NAVY_DK, ink: CREAM, sub: "#AEB6BE", accent: C.amber, dark: true },
    "forward-email": { bg: C.bg, ink: C.text, sub: C.muted, accent: C.green, dark: false },
    "one-thing": { bg: C.navy, ink: CREAM, sub: "#AEB6BE", accent: C.amber, dark: true },
    football: { bg: "#15723E", ink: "#FFFFFF", sub: "#CBE3D3", accent: C.amber, dark: true },
  };
  return map[slug] ?? map["brain-forgets"];
}

/** Small brand wordmark (leaf + "nudge"), centred, tinted for the background. */
function coverWordmark(st: CStyle): string {
  return (
    leafMark(500, 92, 13, st.ink) +
    `<text x="540" y="104" font-size="34" font-weight="800" fill="${st.ink}">nudge</text>`
  );
}

/** Consistent bottom CTA band — fill flips for light vs dark backgrounds. */
function ctaBand(st: CStyle): string {
  const fill = st.dark ? st.accent : C.navy;
  const ink = st.dark ? C.navy : CREAM;
  const link = st.dark ? C.navy : C.amber;
  return (
    `<rect x="90" y="1670" width="900" height="150" rx="28" fill="${fill}"/>` +
    `<text x="540" y="1734" font-size="34" font-weight="800" fill="${ink}" text-anchor="middle">First 10 to register = Pro free for life</text>` +
    `<text x="540" y="1790" font-size="32" font-weight="800" fill="${link}" text-anchor="middle">nudgelive.co.uk</text>`
  );
}

const arrowDown = (cx: number, y: number, c: string) =>
  `<path d="M ${cx} ${y} l 0 60 M ${cx - 22} ${y + 36} l 22 26 l 22 -26" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
const arrowRight = (x: number, cy: number, c: string) =>
  `<path d="M ${x} ${cy} l 70 0 M ${x + 44} ${cy - 22} l 28 22 l -28 22" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
const check = (cx: number, cy: number, c: string) =>
  `<path d="M ${cx - 14} ${cy} l 9 11 l 19 -23" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;

function hookLines(lines: string[], size: number, startY: number, fill = C.text): string {
  const lh = size + 14;
  return lines
    .map(
      (l, i) =>
        `<text x="540" y="${startY + i * lh}" font-size="${size}" font-weight="800" fill="${fill}" text-anchor="middle">${rich(l)}</text>`,
    )
    .join("\n    ");
}

/* ----------------------------- animated SVG ------------------------------- */
/** A group that fades + rises into place at [in0..in1] of the 14s loop, holds. */
function reveal(inner: string, in0: number, in1: number): string {
  return (
    `<g opacity="0">` +
    `<animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${in0};${in1};1" dur="14s" repeatCount="indefinite"/>` +
    `<animateTransform attributeName="transform" type="translate" values="0 26;0 26;0 0;0 0" keyTimes="0;${in0};${in1};1" dur="14s" repeatCount="indefinite"/>` +
    inner +
    `</g>`
  );
}

/**
 * Animated 9:16 clip — the day's cover, brought to life: hook in, the "chaos"
 * beat, then the "sorted" payoff beat, then the CTA. Distinct per day (matches
 * the cover's bg + motif). Loops 14s; screen-record full-screen on a phone.
 */
function buildAnimated(d: Day): string {
  const st = coverStyle(d.slug);
  const m = motif(d, st);
  const big = d.hook.length >= 3;
  const hookSize = big ? 58 : 66;
  const hookY = big ? 240 : 280;
  const lh = hookSize + 14;
  const hook = d.hook
    .map((l, i) => `<text x="540" y="${hookY + i * lh}" font-size="${hookSize}" font-weight="800" fill="${st.ink}" text-anchor="middle">${rich(l)}</text>`)
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920" font-family="Inter, Arial, sans-serif">
  <!-- Nudge — Day ${d.n} (${d.slug}): animated 9:16, loops 14s. Screen-record full-screen on a phone. -->
  <rect width="1080" height="1920" fill="${st.bg}"/>
  ${coverWordmark(st)}
  ${reveal(hook, 0.03, 0.07)}
  ${reveal(m.chaos, 0.1, 0.18)}
  ${reveal(m.resolved, 0.42, 0.5)}
  ${reveal(ctaBand(st), 0.78, 0.84)}
  <rect x="0" y="1900" width="0" height="20" fill="${st.accent}">
    <animate attributeName="width" values="0;1080" dur="14s" repeatCount="indefinite"/>
  </rect>
</svg>
`;
}

/* ------------------------------- cover SVG -------------------------------- */
/** A "messy note" — tilted rounded card with a line of text. */
function note(x: number, y: number, rot: number, w: number, fill: string, txt: string, ink: string): string {
  return (
    `<g transform="rotate(${rot} ${x + w / 2} ${y + 45})">` +
    `<rect x="${x}" y="${y}" width="${w}" height="90" rx="14" fill="${fill}" stroke="#00000014" stroke-width="2"/>` +
    `<text x="${x + 24}" y="${y + 56}" font-size="30" font-weight="700" fill="${ink}">${esc(txt)}</text></g>`
  );
}
/** A clean nudge task card with a check + accent date chip. */
function taskCard(x: number, y: number, w: number, title: string, chip: string, st: CStyle): string {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="120" rx="18" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>` +
    `<circle cx="${x + 44}" cy="${y + 60}" r="22" fill="none" stroke="${C.green}" stroke-width="5"/>` +
    check(x + 44, y + 60, C.green) +
    `<text x="${x + 86}" y="${y + 72}" font-size="34" font-weight="800" fill="${C.text}">${esc(title)}</text>` +
    `<rect x="${x + w - 132}" y="${y + 32}" width="108" height="56" rx="14" fill="${st.accent}"/>` +
    `<text x="${x + w - 78}" y="${y + 70}" font-size="28" font-weight="800" fill="${st.dark ? C.navy : C.white}" text-anchor="middle">${esc(chip)}</text>`
  );
}

/** Per-day concept illustration split into the "chaos" beat and the "sorted"
 *  payoff beat — covers render both together; clips reveal them in sequence. */
function motif(d: Day, st: CStyle): { chaos: string; resolved: string } {
  switch (d.slug) {
    case "brain-forgets": {
      // A genuinely chaotic pile: 8 notes, strong varied angles, overlapping,
      // varied widths/fills/x — visual overwhelm.
      const rots = [-10, 8, -6, 12, -9, 5, -13, 7];
      const xs = [210, 300, 195, 320, 235, 285, 205, 330];
      const ws = [520, 560, 500, 540, 560, 510, 540, 500];
      const fills = [C.mint, "#FBE7BD", CREAM, "#D9E7DF", "#EFE3CC", "#CFE0D5", "#F6E8C8", "#DCEAE1"];
      const chaos = d.input.lines
        .slice(0, 8)
        .map((l, i) => note(xs[i], 408 + i * 62, rots[i], ws[i], fills[i], l, C.navy))
        .join("");
      // Each brain-dump → its own reminder, ordered SOONEST first. Green chip =
      // recurring/appointment (incl. "EVERY THU"), amber = money/deadline.
      const sorted: [string, string, boolean][] = [
        ["Call the plumber", "TODAY", false],
        ["Put the bins out", "EVERY THU", true],
        ["School trip £15", "FRI", false],
        ["Dentist check-up", "TUE 9:30", true],
        ["Library books back", "18 JUN", true],
        ["Cancel free trial", "20 JUN", false],
        ["Pay the water bill", "28 JUN", false],
        ["Mum's birthday", "12 JUL", true],
      ];
      const mini = (y: number, title: string, chip: string, green: boolean) => {
        const cw = chip.length * 15 + 36;
        const cx = 886 - cw;
        const fill = green ? C.green : C.amber;
        return (
          `<rect x="170" y="${y}" width="716" height="64" rx="14" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>` +
          `<circle cx="212" cy="${y + 32}" r="15" fill="none" stroke="${C.green}" stroke-width="4"/>` +
          check(212, y + 32, C.green) +
          `<text x="250" y="${y + 42}" font-size="28" font-weight="800" fill="${C.text}">${esc(title)}</text>` +
          `<rect x="${cx}" y="${y + 13}" width="${cw}" height="38" rx="10" fill="${fill}"/>` +
          `<text x="${cx + cw / 2}" y="${y + 39}" font-size="21" font-weight="800" fill="${green ? C.white : C.navy}" text-anchor="middle">${esc(chip)}</text>`
        );
      };
      const cards = sorted.map(([t, chip, g], i) => mini(1010 + i * 76, t, chip, g)).join("");
      return { chaos, resolved: arrowDown(540, 936, st.accent) + cards };
    }
    case "free-trial": {
      const RED = "#E5484D";
      // The nasty surprise: a bank charge for a trial you forgot to cancel.
      const chaos =
        `<rect x="150" y="470" width="780" height="300" rx="26" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>` +
        `<circle cx="220" cy="540" r="30" fill="#FBE0E1"/>` +
        `<text x="220" y="553" font-size="34" font-weight="800" fill="${RED}" text-anchor="middle">£</text>` +
        `<text x="276" y="532" font-size="24" font-weight="800" fill="${RED}" letter-spacing="1">PAYMENT TAKEN</text>` +
        `<text x="276" y="566" font-size="24" fill="${C.muted}">ACME Pro · annual renewal</text>` +
        `<text x="190" y="680" font-size="92" font-weight="800" fill="${RED}">– £79.00</text>` +
        `<text x="190" y="732" font-size="25" fill="${C.muted}">…the 7-day trial you forgot to cancel</text>`;
      // The fix: nudge reminds you before it renews.
      const resolved =
        arrowDown(540, 800, st.accent) +
        `<rect x="150" y="900" width="780" height="200" rx="26" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>` +
        `<circle cx="210" cy="972" r="22" fill="none" stroke="${C.green}" stroke-width="5"/>` +
        check(210, 972, C.green) +
        `<text x="250" y="984" font-size="34" font-weight="800" fill="${C.navy}">Cancel free trial</text>` +
        `<text x="190" y="1046" font-size="25" fill="${C.muted}">nudge reminds you 2 days before it renews</text>` +
        `<rect x="700" y="934" width="200" height="54" rx="14" fill="${st.accent}"/>` +
        `<text x="800" y="971" font-size="22" font-weight="800" fill="${C.navy}" text-anchor="middle">HEADS-UP</text>` +
        `<text x="540" y="1190" font-size="34" font-weight="800" fill="${st.accent}" text-anchor="middle">Never auto-charged again.</text>`;
      return { chaos, resolved };
    }
    case "mental-load": {
      const tower = d.input.lines
        .slice(0, 4)
        .map((l, i) => {
          const w = 360 - i * 30,
            x = 360 - (360 - i * 30 - 300) / 2,
            y = 760 - i * 70,
            rot = i % 2 ? 3 : -3;
          return (
            `<g transform="rotate(${rot} ${x + w / 2} ${y + 26})">` +
            `<rect x="${x}" y="${y}" width="${w}" height="52" rx="12" fill="${i === 0 ? st.accent : C.white}" stroke="#0000001a" stroke-width="2"/>` +
            `<text x="${x + 20}" y="${y + 35}" font-size="24" font-weight="700" fill="${C.navy}">${esc(l)}</text></g>`
          );
        })
        .join("");
      const head =
        `<circle cx="540" cy="900" r="78" fill="none" stroke="${C.navy}" stroke-width="9"/>` +
        `<path d="M 470 1010 q 70 -70 140 0" fill="none" stroke="${C.navy}" stroke-width="9" stroke-linecap="round"/>`;
      return {
        chaos: tower + head,
        resolved:
          arrowDown(540, 1080, st.accent) +
          `<text x="540" y="1200" font-size="34" font-weight="800" fill="${st.accent}" text-anchor="middle">…now it's all held for you</text>`,
      };
    }
    case "promo": {
      const ray = Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * 2 * Math.PI;
        return `<line x1="${540 + 150 * Math.cos(a)}" y1="${760 + 150 * Math.sin(a)}" x2="${540 + 185 * Math.cos(a)}" y2="${760 + 185 * Math.sin(a)}"/>`;
      }).join("");
      return {
        chaos:
          `<path d="M 470 880 l -30 240 l 100 -60 z" fill="${C.green}"/>` +
          `<path d="M 610 880 l 30 240 l -100 -60 z" fill="${C.green}"/>` +
          `<g stroke="${st.accent}" stroke-width="10" stroke-linecap="round">${ray}</g>` +
          `<circle cx="540" cy="760" r="150" fill="${st.accent}"/>` +
          `<text x="540" y="730" font-size="40" font-weight="800" fill="${C.navy}" text-anchor="middle">PRO</text>` +
          `<text x="540" y="780" font-size="34" font-weight="800" fill="${C.navy}" text-anchor="middle">FREE</text>` +
          `<text x="540" y="822" font-size="30" font-weight="700" fill="${C.navy}" text-anchor="middle">for life</text>`,
        resolved:
          `<text x="540" y="1240" font-size="42" font-weight="800" fill="${st.ink}" text-anchor="middle">First 10 to register interest</text>` +
          `<text x="540" y="1300" font-size="40" font-weight="800" fill="${st.accent}" text-anchor="middle">= Pro free for life</text>`,
      };
    }
    case "forward-email": {
      return {
        chaos:
          `<rect x="150" y="700" width="300" height="200" rx="16" fill="${C.white}" stroke="${C.border}" stroke-width="3"/>` +
          `<path d="M 150 716 L 300 820 L 450 716" fill="none" stroke="${C.green}" stroke-width="6"/>` +
          `<text x="300" y="880" font-size="24" font-weight="700" fill="${C.muted}" text-anchor="middle">FWD: booking</text>`,
        resolved:
          arrowRight(478, 800, st.accent) +
          `<rect x="630" y="700" width="300" height="200" rx="16" fill="${C.white}" stroke="${C.border}" stroke-width="3"/>` +
          `<circle cx="690" cy="770" r="22" fill="none" stroke="${C.green}" stroke-width="5"/>` +
          check(690, 770, C.green) +
          `<text x="724" y="782" font-size="28" font-weight="800" fill="${C.text}">Dinner</text>` +
          `<text x="660" y="850" font-size="24" fill="${C.muted}">Fri · 7:30pm</text>` +
          `<text x="540" y="1120" font-size="34" font-weight="800" fill="${st.accent}" text-anchor="middle">the what, when &amp; where — pulled out</text>`,
      };
    }
    case "one-thing": {
      const bubble = (x: number, y: number, w: number, t: string) =>
        `<rect x="${x}" y="${y}" width="${w}" height="80" rx="40" fill="${C.white}"/>` +
        `<text x="${x + w / 2}" y="${y + 52}" font-size="30" font-weight="700" fill="${C.navy}" text-anchor="middle">${esc(t)}</text>`;
      return {
        chaos:
          `<text x="540" y="930" font-size="420" font-weight="800" fill="${st.accent}" text-anchor="middle">?</text>` +
          bubble(160, 540, 300, "bin day?") +
          bubble(640, 640, 360, "that 'starred' email?") +
          bubble(250, 1040, 340, "renew the car tax?"),
        resolved: `<text x="540" y="1230" font-size="34" font-weight="800" fill="${st.ink}" text-anchor="middle">comment yours</text>`,
      };
    }
    case "football": {
      // Football icon (white ball + a few black patches) at (cx,cy) radius r.
      const ball = (cx: number, cy: number, r: number) => {
        const pent = Array.from({ length: 5 }, (_, i) => {
          const a = (-90 + i * 72) * (Math.PI / 180);
          return `${(cx + r * 0.42 * Math.cos(a)).toFixed(1)},${(cy + r * 0.42 * Math.sin(a)).toFixed(1)}`;
        }).join(" ");
        return (
          `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="#111827" stroke-width="${(r * 0.1).toFixed(1)}"/>` +
          `<polygon points="${pent}" fill="#111827"/>`
        );
      };
      const note2 = (x: number, y: number, rot: number, w: number, t: string) =>
        `<g transform="rotate(${rot} ${x + w / 2} ${y + 38})">` +
        `<rect x="${x}" y="${y}" width="${w}" height="76" rx="12" fill="#FBE7BD" stroke="#00000014" stroke-width="2"/>` +
        `<text x="${x + 22}" y="${y + 50}" font-size="30" font-weight="700" fill="${C.navy}">${esc(t)}</text></g>`;
      const chaos =
        `<circle cx="540" cy="700" r="250" fill="none" stroke="#ffffff22" stroke-width="4"/>` +
        `<rect x="200" y="430" width="680" height="96" rx="18" fill="#0E3D22"/>` +
        ball(258, 478, 34) +
        `<text x="320" y="468" font-size="26" font-weight="800" fill="#fff">MATCH DAY</text>` +
        `<text x="320" y="502" font-size="24" fill="#CBE3D3">Tue · 20:00 kick-off</text>` +
        note2(250, 580, -6, 520, "£5 sweepstake?") +
        note2(290, 678, 5, 500, "book the pub!!") +
        note2(240, 776, -4, 520, "snacks?? set alarm");
      const mini = (y: number, title: string, chip: string, green: boolean) => {
        const cw = chip.length * 15 + 36;
        const cx = 886 - cw;
        return (
          `<rect x="170" y="${y}" width="716" height="76" rx="14" fill="${C.white}"/>` +
          `<circle cx="214" cy="${y + 38}" r="16" fill="none" stroke="${C.green}" stroke-width="4"/>` +
          check(214, y + 38, C.green) +
          `<text x="250" y="${y + 48}" font-size="30" font-weight="800" fill="${C.navy}">${esc(title)}</text>` +
          `<rect x="${cx}" y="${y + 18}" width="${cw}" height="40" rx="10" fill="${green ? C.green : C.amber}"/>` +
          `<text x="${cx + cw / 2}" y="${y + 45}" font-size="21" font-weight="800" fill="${green ? C.white : C.navy}" text-anchor="middle">${esc(chip)}</text>`
        );
      };
      const cards = (
        [
          ["Kick-off — England", "19:45 TUE", true],
          ["Pay the sweepstake", "£5", false],
          ["Book the pub table", "TODAY", true],
          ["Snacks run", "TUE", true],
        ] as [string, string, boolean][]
      )
        .map(([t, c, g], i) => mini(992 + i * 92, t, c, g))
        .join("");
      return { chaos, resolved: arrowDown(540, 906, st.accent) + cards };
    }
    default:
      return { chaos: "", resolved: "" };
  }
}

function buildCover(d: Day): string {
  const st = coverStyle(d.slug);
  const big = d.hook.length >= 3;
  const hookSize = big ? 58 : 66;
  const hookY = big ? 240 : 280;
  const lh = hookSize + 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920" font-family="Inter, Arial, sans-serif">
  <!-- Nudge — Day ${d.n} (${d.slug}) cover. Distinct bg + concept motif per day. -->
  <rect width="1080" height="1920" fill="${st.bg}"/>
  ${coverWordmark(st)}
  ${d.hook.map((l, i) => `<text x="540" y="${hookY + i * lh}" font-size="${hookSize}" font-weight="800" fill="${st.ink}" text-anchor="middle">${rich(l)}</text>`).join("\n  ")}
  ${(() => { const m = motif(d, st); return m.chaos + m.resolved; })()}
  ${ctaBand(st)}
</svg>
`;
}

/* --------------------------------- data ----------------------------------- */
const G = C.green,
  A = C.amber;
const DAYS: Day[] = [
  {
    n: 2,
    slug: "brain-forgets",
    hook: ["Want peace of mind?", "Empty your head."],
    input: {
      title: "MY HEAD, 9PM",
      lines: [
        "bin day — which bin?!",
        "mum's bday… next month?",
        "cancel that free trial!!",
        "dentist — some Tuesday?",
        "PLUMBER still dripping",
        "water bill?? which one",
        "library books overdue?",
        "school trip money??",
      ],
      hint: "too much to hold.",
    },
    header: "✨ Now they live in Nudge",
    transition: "Nudge holds them ↓",
    tasks: [
      { emoji: "🗑️", title: "Put the bins out", sub: "Recycling week", chip: "WED", chipFill: G },
      { emoji: "🦷", title: "Dentist check-up", sub: "Reminder set", chip: "TUE", chipFill: G },
    ],
    footnote: ["One place for all of it.", "A gentle nudge before each one."],
  },
  {
    n: 3,
    slug: "free-trial",
    hook: ["The “free” trial you", "forgot to cancel."],
    input: {
      title: "FREE TRIAL ENDS",
      lines: ["Charges £79/yr after 7 days", "…and you'll forget", "every single time"],
      hint: "let Nudge catch it",
    },
    header: "✨ Nudge reminds you in time",
    transition: "Nudge catches it ↓",
    tasks: [
      { emoji: "🔁", title: "Cancel free trial", sub: "2 days before it renews", chip: "HEADS-UP", chipFill: A },
    ],
    footnote: ["Never auto-charged again.", "Nudge nudges you before it renews."],
  },
  {
    n: 4,
    slug: "mental-load",
    hook: ["The mental load is", "invisible — until you", "write it ALL down"],
    input: {
      title: "EVERYTHING IN YOUR HEAD",
      lines: ["School trip form", "Call the dentist", "Pay the gas bill", "Renew the car tax"],
    },
    header: "✨ Out of your head",
    transition: "Nudge sorts it ↓",
    tasks: [
      { emoji: "📝", title: "School trip form", sub: "Hand it in", chip: "FRI", chipFill: G },
      { emoji: "🚗", title: "Renew car tax", sub: "Before month end", chip: "30", chipFill: A },
    ],
    footnote: ["Your brain isn't a to-do list.", "Give the load to Nudge."],
  },
  {
    n: 5,
    slug: "promo",
    hook: ["We're opening Nudge", "very soon."],
    input: {
      title: "EARLY-BIRD OFFER",
      lines: ["Register your interest now", "Skip the launch queue", "Lock in founder perks"],
      hint: "before the doors open",
    },
    header: "✨ Two ways to win",
    transition: "Get in early ↓",
    tasks: [
      { emoji: "🎁", title: "First 10 to register", sub: "Nudge Pro — free for LIFE", chip: "10", chipFill: A },
      { emoji: "⭐", title: "Be one of the first 10", sub: "Pro free for life", chip: "10", chipFill: G },
    ],
    footnote: ["The first-10 spots close soon.", "nudgelive.co.uk"],
  },
  {
    n: 6,
    slug: "forward-email",
    hook: ["Forward your chaos", "to a robot. Watch."],
    input: {
      title: "FWD: Booking confirmed",
      lines: ["Your table for 4 is booked", "Fri 20 June, 7:30pm", "The Brasserie, High St", "Ref: BR-8821"],
      hint: "forward it to Nudge →",
    },
    header: "✨ Forwarded → sorted",
    transition: "Nudge reads it ↓",
    tasks: [{ emoji: "🍽️", title: "Dinner — table for 4", sub: "The Brasserie, 7:30pm", chip: "FRI", chipFill: G }],
    footnote: ["Forward any email to Nudge.", "It pulls out the what, when & where."],
  },
  {
    n: 7,
    slug: "one-thing",
    hook: ["What's the ONE thing", "you always forget?"],
    input: {
      title: "USUAL SUSPECTS",
      lines: ["Birthdays", "Bin day", "Renewals", "That 'starred' email"],
    },
    header: "✨ Tell me yours",
    transition: "Comment below ↓",
    tasks: [{ emoji: "💬", title: "Drop it in the comments", sub: "I'll show you the Nudge for it", chip: "YOU?", chipFill: G }],
    footnote: ["First 10 to register interest:", "Pro free for life · nudgelive.co.uk"],
  },
];

/* -------------------------------- render ---------------------------------- */
const outDir = join(process.cwd(), "public", "social");
mkdirSync(outDir, { recursive: true });

for (const d of DAYS) {
  const nn = String(d.n).padStart(2, "0");
  const animName = `day${nn}-${d.slug}.svg`;
  writeFileSync(join(outDir, animName), buildAnimated(d));

  const coverSvg = buildCover(d);
  writeFileSync(join(outDir, `day${nn}-cover.svg`), coverSvg);
  const png = new Resvg(coverSvg, { fitTo: { mode: "width", value: 1080 } }).render().asPng();
  writeFileSync(join(outDir, `day${nn}-cover.png`), png);
  console.log(`  day ${nn}: ${animName} + day${nn}-cover.png`);
}
// One-off topical post: World Cup / "It's coming home" (football admin).
const footballDay: Day = {
  n: 0,
  slug: "football",
  hook: ["It's coming home.", "So is the admin."],
  input: { title: "MATCH DAY", lines: [] },
  header: "",
  transition: "",
  tasks: [],
  footnote: ["", ""],
};
writeFileSync(join(outDir, "football.svg"), buildAnimated(footballDay));
const footballCover = buildCover(footballDay);
const footballPng = new Resvg(footballCover, { fitTo: { mode: "width", value: 1080 } }).render().asPng();
writeFileSync(join(outDir, "football-cover.png"), footballPng);
console.log("  football: football.svg + football-cover.png");

console.log("Done → public/social/");
