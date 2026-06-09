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
    "mental-load": { bg: C.mint, ink: C.navy, sub: "#46584E", accent: C.greenDk, dark: false },
    promo: { bg: NAVY_DK, ink: CREAM, sub: "#AEB6BE", accent: C.amber, dark: true },
    "forward-email": { bg: C.bg, ink: C.text, sub: C.muted, accent: C.green, dark: false },
    "one-thing": { bg: C.navy, ink: CREAM, sub: "#AEB6BE", accent: C.amber, dark: true },
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
  const accent = st.dark ? C.navy : C.amber;
  return (
    `<rect x="90" y="1640" width="900" height="210" rx="28" fill="${fill}"/>` +
    `<text x="540" y="1716" font-size="33" font-weight="800" fill="${ink}" text-anchor="middle">First 10 to register = Pro free for life</text>` +
    `<text x="540" y="1772" font-size="29" font-weight="700" fill="${st.dark ? "#1c232b" : C.mint}" text-anchor="middle">then 3 months free for everyone else</text>` +
    `<text x="540" y="1822" font-size="31" font-weight="800" fill="${accent === C.navy ? C.navy : C.amber}" text-anchor="middle">nudgelive.co.uk</text>`
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
      const fills = [C.mint, "#FBE7BD", CREAM, "#D9E7DF"];
      const chaos = d.input.lines
        .slice(0, 4)
        .map((l, i) =>
          note(250 + (i % 2) * 60, 470 + i * 120, i % 2 ? 5 : -6, 520, fills[i % fills.length], l, C.navy),
        )
        .join("");
      return {
        chaos,
        resolved: arrowDown(540, 1000, st.accent) + taskCard(240, 1110, 600, "Dentist — Tue 9:30", "TUE", st),
      };
    }
    case "screenshot-graveyard": {
      const cells = [];
      for (let i = 0; i < 9; i++) {
        const cx = 430 + (i % 3) * 80,
          cy = 560 + Math.floor(i / 3) * 150;
        cells.push(
          `<rect x="${cx}" y="${cy}" width="64" height="120" rx="10" fill="#2E3741"/>` +
            `<rect x="${cx + 8}" y="${cy + 10}" width="48" height="40" rx="6" fill="${i % 3 === 0 ? st.accent : "#46535F"}"/>`,
        );
      }
      return {
        chaos:
          `<rect x="390" y="490" width="300" height="640" rx="40" fill="#1C232B" stroke="#3A4650" stroke-width="4"/>` +
          cells.join("") +
          `<circle cx="720" cy="540" r="90" fill="${st.accent}"/>` +
          `<text x="720" y="540" font-size="60" font-weight="800" fill="${C.navy}" text-anchor="middle">237</text>` +
          `<text x="720" y="585" font-size="22" font-weight="700" fill="${C.navy}" text-anchor="middle">UNREAD</text>`,
        resolved: arrowDown(540, 1190, st.accent) + taskCard(240, 1290, 600, "Move car — 6pm", "6PM", st),
      };
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
          `<text x="540" y="1230" font-size="40" font-weight="800" fill="${st.ink}" text-anchor="middle">First 10 to register interest</text>` +
          `<text x="540" y="1290" font-size="32" font-weight="700" fill="${st.sub}" text-anchor="middle">everyone else → 3 months free</text>`,
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
    hook: ["Things my brain", "refuses to remember:"],
    input: {
      title: "MY HEAD, 9PM",
      lines: ["Bin day (which bin?)", "Dentist — Tuesday?", "Mum's birthday soon", "That bill. Which bill."],
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
    slug: "screenshot-graveyard",
    hook: ["Your camera roll is a", "to-do list in disguise"],
    input: {
      title: "SCREENSHOTS, UNREAD",
      lines: ["Appointment confirmation", "Parking reminder", "Event poster", "…and 237 more"],
      hint: "just share them to Nudge",
    },
    header: "✨ Nudge actually reads them",
    transition: "Nudge reads them ↓",
    tasks: [
      { emoji: "🅿️", title: "Move the car", sub: "From your parking shot", chip: "6PM", chipFill: G },
      { emoji: "🎟️", title: "Gig — doors 7:30", sub: "From the poster", chip: "SAT", chipFill: G },
    ],
    footnote: ["Stop hoarding screenshots.", "Let Nudge turn them into reminders."],
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
      { emoji: "⭐", title: "Everyone else who joins", sub: "3 months of Pro, free", chip: "3MO", chipFill: G },
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
console.log("Done → public/social/");
