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

const PROMO_STRIP = `
  <rect x="90" y="1470" width="900" height="300" rx="26" fill="${C.navy}"/>
  <text x="540" y="1556" font-size="30" font-weight="700" fill="${C.mint}" text-anchor="middle" letter-spacing="2">LAUNCH OFFER</text>
  <text x="540" y="1622" font-size="40" font-weight="800" fill="${C.white}" text-anchor="middle">First 10 to register interest</text>
  <text x="540" y="1680" font-size="44" font-weight="800" fill="${C.mint}" text-anchor="middle">get Nudge Pro FREE for life</text>
  <text x="540" y="1742" font-size="34" font-weight="700" fill="${C.white}" text-anchor="middle">nudgelive.co.uk · link in bio</text>`;

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
function buildAnimated(d: Day): string {
  const hookSize = d.hook.length >= 3 ? 54 : 58;
  const hookY = d.hook.length >= 3 ? 300 : 320;

  // input card
  const inLines = d.input.lines
    .map((l, i) => `<text x="240" y="${884 + i * 64}" font-size="32" fill="${C.text}">${rich(l)}</text>`)
    .join("\n      ");
  const hint = d.input.hint
    ? `<text x="240" y="${884 + d.input.lines.length * 64 + 40}" font-size="28" fill="${C.faint}" font-style="italic">${esc(d.input.hint)}</text>`
    : "";

  // task cards (staggered pop)
  const Y0 = 540,
    PITCH = 240,
    H = 200;
  const tasks = d.tasks
    .map((t, i) => {
      const y = Y0 + i * PITCH;
      const inA = 0.4 + i * 0.1;
      const cw = Math.max(150, t.chip.length * 30 + 60);
      const cx = 940 - cw;
      return `
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${inA.toFixed(2)};${(inA + 0.04).toFixed(2)};1" dur="14s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="translate" values="0 28;0 28;0 0;0 0" keyTimes="0;${inA.toFixed(2)};${(inA + 0.05).toFixed(2)};1" dur="14s" repeatCount="indefinite"/>
      <rect x="120" y="${y}" width="840" height="${H}" rx="22" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>
      <text x="170" y="${y + 96}" font-size="44" font-weight="800" fill="${C.text}">${esc(t.emoji)} ${esc(t.title)}</text>
      <text x="170" y="${y + 156}" font-size="30" fill="${C.muted}">${esc(t.sub)}</text>
      <rect x="${cx}" y="${y + 46}" width="${cw}" height="78" rx="16" fill="${t.chipFill}"/>
      <text x="${cx + cw / 2}" y="${y + 97}" font-size="32" font-weight="800" fill="${C.white}" text-anchor="middle">${esc(t.chip)}</text>
    </g>`;
    })
    .join("");
  const footY = Y0 + d.tasks.length * PITCH + 60;
  const footA = (0.4 + d.tasks.length * 0.1 + 0.04).toFixed(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920" font-family="Inter, Arial, sans-serif">
  <!-- Nudge — Day ${d.n} (${d.slug}): animated 9:16, loops 14s. Screen-record full-screen on a phone. -->
  <rect width="1080" height="1920" fill="${C.bg}"/>
  ${WORDMARK}

  <!-- SCENE 1: hook + the messy input -->
  <g opacity="0">
    <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.03;0.31;0.345;1" dur="14s" repeatCount="indefinite"/>
    ${hookLines(d.hook, hookSize, hookY)}
    <g transform="rotate(-3 540 1080)">
      <rect x="190" y="600" width="700" height="900" rx="16" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>
      <rect x="190" y="600" width="700" height="120" rx="16" fill="${C.greenTint}"/>
      <text x="240" y="678" font-size="34" font-weight="800" fill="${C.greenDk}">${esc(d.input.title)}</text>
      <line x1="240" y1="760" x2="840" y2="760" stroke="${C.border}" stroke-width="2"/>
      ${inLines}
      ${hint}
    </g>
  </g>

  <!-- SCENE 2: Nudge sorts it -->
  <g opacity="0">
    <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.345;0.38;0.75;0.785;1" dur="14s" repeatCount="indefinite"/>
    <rect x="180" y="300" width="720" height="84" rx="42" fill="${C.greenTint}"/>
    <text x="540" y="354" font-size="34" font-weight="800" fill="${C.greenDk}" text-anchor="middle">${esc(d.header)}</text>
    ${tasks}
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${footA};${(Number(footA) + 0.04).toFixed(2)};1" dur="14s" repeatCount="indefinite"/>
      <text x="540" y="${footY}" font-size="34" fill="${C.greenDk}" text-anchor="middle" font-weight="700">${esc(d.footnote[0])}</text>
      <text x="540" y="${footY + 56}" font-size="32" fill="${C.muted}" text-anchor="middle">${esc(d.footnote[1])}</text>
    </g>
  </g>

  ${PROMO_SCENE}

  <rect x="0" y="1900" width="0" height="20" fill="${C.green}">
    <animate attributeName="width" values="0;1080" dur="14s" repeatCount="indefinite"/>
  </rect>
</svg>
`;
}

/* ------------------------------- cover SVG -------------------------------- */
function buildCover(d: Day): string {
  const hookSize = d.hook.length >= 3 ? 50 : 56;
  const hookY = d.hook.length >= 3 ? 210 : 246;
  const lh = hookSize + 12;

  const inLines = d.input.lines
    .slice(0, 5)
    .map((l, i) => `<text x="320" y="${540 + i * 46}" font-size="26" fill="${C.text}">${rich(l)}</text>`)
    .join("\n    ");
  const hint = d.input.hint
    ? `<text x="320" y="${540 + Math.min(d.input.lines.length, 5) * 46 + 24}" font-size="24" fill="${C.faint}" font-style="italic">${esc(d.input.hint)}</text>`
    : "";

  const n = Math.min(d.tasks.length, 3);
  const startY = 970,
    pitch = 200,
    h = 170;
  const cards = d.tasks
    .slice(0, 3)
    .map((t, i) => {
      const y = startY + i * pitch;
      const cw = Math.max(140, t.chip.length * 28 + 56);
      const cx = 910 - cw;
      return `
  <rect x="120" y="${y}" width="840" height="${h}" rx="20" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>
  <text x="160" y="${y + 86}" font-size="40" font-weight="800" fill="${C.text}">${esc(t.title)}</text>
  <text x="160" y="${y + 134}" font-size="27" fill="${C.muted}">${esc(t.sub)}</text>
  <rect x="${cx}" y="${y + 50}" width="${cw}" height="70" rx="14" fill="${t.chipFill}"/>
  <text x="${cx + cw / 2}" y="${y + 97}" font-size="30" font-weight="800" fill="${C.white}" text-anchor="middle">${esc(t.chip)}</text>`;
    })
    .join("");
  const stripY = Math.max(1470, startY + n * pitch + 60);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920" font-family="Inter, Arial, sans-serif">
  <!-- Nudge — Day ${d.n} (${d.slug}) static cover. Facebook image / TikTok thumbnail. -->
  <rect width="1080" height="1920" fill="${C.bg}"/>
  <rect x="378" y="70" width="60" height="60" rx="17" fill="${C.green}"/>
  <text x="408" y="114" font-size="38" font-weight="800" fill="${C.white}" text-anchor="middle">n</text>
  <text x="456" y="114" font-size="36" font-weight="800" fill="${C.text}">nudge</text>

  ${d.hook.map((l, i) => `<text x="540" y="${hookY + i * lh}" font-size="${hookSize}" font-weight="800" fill="${C.text}" text-anchor="middle">${rich(l)}</text>`).join("\n  ")}

  <g transform="rotate(-3 540 640)">
    <rect x="290" y="450" width="500" height="380" rx="14" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>
    <rect x="290" y="450" width="500" height="76" rx="14" fill="${C.greenTint}"/>
    <text x="320" y="500" font-size="26" font-weight="800" fill="${C.greenDk}">${esc(d.input.title)}</text>
    ${inLines}
    ${hint}
  </g>

  <text x="540" y="910" font-size="40" font-weight="800" fill="${C.green}" text-anchor="middle">${esc(d.transition)}</text>
  ${cards}
  ${PROMO_STRIP.replace('y="1470"', `y="${stripY}"`).replace(/y="1556"/, `y="${stripY + 86}"`).replace(/y="1622"/, `y="${stripY + 152}"`).replace(/y="1680"/, `y="${stripY + 210}"`).replace(/y="1742"/, `y="${stripY + 272}"`)}
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
