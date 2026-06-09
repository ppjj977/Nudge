import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Animated how-to guides (looping SVG "videos", 720×1280) for the in-app Help
 * page. They animate in the browser via SMIL — no video file needed. Each guide
 * cross-fades 3 captioned steps showing the real app UI doing the action.
 * Run: npx tsx scripts/gen-guides.ts
 */
const C = {
  green: "#7BAA94",
  greenDk: "#3C5A4C",
  greenTint: "#EDF2EF",
  amber: "#F5B52E",
  navy: "#232A32",
  mint: "#CFE0D5",
  cream: "#ECE6D6",
  bg: "#F8F7F4",
  white: "#FFFFFF",
  muted: "#667085",
  faint: "#9AA4AE",
  border: "#E9E9E3",
};
const W = 720;
const H = 1280;
const DUR = 12; // seconds per loop

function leafMark(tx: number, ty: number, k: number, nColor: string): string {
  const r = 34;
  const path = `M ${16} ${16} L ${50} ${16} A ${r} ${r} 0 0 1 ${84} ${50} L ${84} ${84} L ${50} ${84} A ${r} ${r} 0 0 1 ${16} ${50} Z`;
  const inner =
    `<path d="${path}" fill="none" stroke="${C.green}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<text x="45" y="64" font-size="44" font-weight="700" fill="${nColor}" text-anchor="middle">n</text>` +
    `<circle cx="64" cy="59" r="5.5" fill="${C.amber}"/>`;
  return `<g transform="translate(${tx},${ty}) scale(${k})">${inner}</g>`;
}

const appbar =
  `<rect x="0" y="0" width="${W}" height="86" fill="${C.white}"/>` +
  `<line x1="0" y1="86" x2="${W}" y2="86" stroke="${C.border}" stroke-width="2"/>` +
  leafMark(28, 22, 0.46, C.navy) +
  `<text x="72" y="55" font-size="30" font-weight="800" fill="${C.navy}">nudge</text>`;

/** A finger-tap ring at (x,y). */
const tap = (x: number, y: number) =>
  `<circle cx="${x}" cy="${y}" r="34" fill="${C.navy}" opacity="0.16"/>` +
  `<circle cx="${x}" cy="${y}" r="22" fill="${C.navy}" opacity="0.30"/>`;

const check = (cx: number, cy: number, c: string) =>
  `<path d="M ${cx - 13} ${cy} l 8 10 l 18 -22" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;

/** A clean task card. */
function taskCard(y: number, title: string, sub: string, chip: string, chipFill: string): string {
  const cw = chip.length * 16 + 40;
  return (
    `<rect x="40" y="${y}" width="640" height="150" rx="20" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>` +
    `<circle cx="86" cy="${y + 56}" r="20" fill="none" stroke="${C.green}" stroke-width="5"/>` +
    check(86, y + 56, C.green) +
    `<text x="124" y="${y + 66}" font-size="32" font-weight="800" fill="${C.navy}">${title}</text>` +
    `<text x="124" y="${y + 112}" font-size="26" fill="${C.muted}">${sub}</text>` +
    `<rect x="${640 - cw}" y="${y + 38}" width="${cw}" height="50" rx="13" fill="${chipFill}"/>` +
    `<text x="${640 - cw / 2}" y="${y + 72}" font-size="24" font-weight="800" fill="${C.white}" text-anchor="middle">${chip}</text>`
  );
}

/** Bottom caption bar — the step number + instruction. */
function caption(n: number, text: string): string {
  return (
    `<rect x="40" y="1120" width="640" height="120" rx="22" fill="${C.navy}"/>` +
    `<circle cx="96" cy="1180" r="30" fill="${C.amber}"/>` +
    `<text x="96" y="1192" font-size="34" font-weight="800" fill="${C.navy}" text-anchor="middle">${n}</text>` +
    `<text x="150" y="1190" font-size="28" font-weight="700" fill="${C.cream}">${text}</text>`
  );
}

/** Cross-fade scene i of n across the loop. */
function scene(i: number, n: number, inner: string): string {
  const seg = 1 / n;
  const a = i * seg,
    b = (i + 1) * seg;
  const k = [0, a, a + 0.02, b - 0.03, b, 1].map((v) => v.toFixed(3)).join(";");
  return (
    `<g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="${k}" dur="${DUR}s" repeatCount="indefinite"/>` +
    inner +
    `</g>`
  );
}

function build(scenes: string[]): string {
  const body = scenes.map((s, i) => scene(i, scenes.length, s)).join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, Arial, sans-serif">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  ${body}
  ${appbar}
  <rect x="0" y="${H - 8}" width="0" height="8" fill="${C.green}"><animate attributeName="width" values="0;${W}" dur="${DUR}s" repeatCount="indefinite"/></rect>
</svg>`;
}

/* --------------------------------- guides --------------------------------- */
const wrapCard = (y: number, h: number, inner: string) =>
  `<rect x="40" y="${y}" width="640" height="${h}" rx="20" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>${inner}`;

const reading = (y: number) =>
  `<rect x="40" y="${y}" width="640" height="96" rx="20" fill="${C.greenTint}"/>` +
  `<circle cx="92" cy="${y + 48}" r="16" fill="none" stroke="${C.green}" stroke-width="5" stroke-dasharray="60 20"><animateTransform attributeName="transform" type="rotate" from="0 92 ${y + 48}" to="360 92 ${y + 48}" dur="1s" repeatCount="indefinite"/></circle>` +
  `<text x="130" y="${y + 58}" font-size="28" font-weight="700" fill="${C.greenDk}">nudge is reading it…</text>`;

const guides: Record<string, string> = {
  // ---- Forward an email ----
  "forward-email": build([
    wrapCard(200, 360,
      `<text x="72" y="270" font-size="26" font-weight="700" fill="${C.muted}">Forward to</text>` +
      `<rect x="72" y="290" width="576" height="60" rx="12" fill="${C.bg}"/>` +
      `<text x="92" y="330" font-size="26" font-weight="700" fill="${C.navy}">capture-7f3@in.nudgelive.co.uk</text>` +
      `<text x="72" y="420" font-size="28" font-weight="800" fill="${C.navy}">Booking confirmed — Fri 7:30pm</text>` +
      `<text x="72" y="465" font-size="24" fill="${C.muted}">Table for 4, The Brasserie</text>` +
      `<rect x="498" y="500" width="150" height="60" rx="14" fill="${C.green}"/>` +
      `<text x="573" y="540" font-size="26" font-weight="800" fill="${C.white}" text-anchor="middle">Send</text>`) +
      tap(573, 530) +
      caption(1, "Forward any email to your nudge address"),
    reading(520) + caption(2, "It reads the what, when &amp; where"),
    taskCard(360, "Dinner — table for 4", "The Brasserie · Fri 7:30pm", "FRI", C.green) +
      `<text x="360" y="640" font-size="26" fill="${C.muted}" text-anchor="middle">…with a reminder set.</text>` +
      caption(3, "It lands on your timeline"),
  ]),

  // ---- Create a task manually ----
  "create-task": build([
    wrapCard(200, 300,
      `<text x="72" y="262" font-size="26" font-weight="700" fill="${C.muted}">Capture anything…</text>` +
      `<rect x="72" y="284" width="576" height="80" rx="14" fill="${C.bg}"/>` +
      `<text x="92" y="334" font-size="28" font-weight="700" fill="${C.navy}">pay water bill friday £42<tspan fill="${C.green}">|</tspan></text>` +
      `<rect x="430" y="400" width="218" height="64" rx="14" fill="${C.green}"/>` +
      `<text x="539" y="442" font-size="28" font-weight="800" fill="${C.white}" text-anchor="middle">Capture</text>`) +
      tap(539, 432) +
      caption(1, "Type it like a human — no forms"),
    reading(420) + caption(2, "Nudge pulls out the task, date &amp; amount"),
    taskCard(360, "Pay water bill", "£42 · due Friday", "FRI", C.amber) +
      caption(3, "Sorted — reminder set automatically"),
  ]),

  // ---- Snooze a task ----
  snooze: build([
    wrapCard(220, 230,
      `<text x="72" y="300" font-size="32" font-weight="800" fill="${C.navy}">Dentist check-up</text>` +
      `<text x="72" y="346" font-size="26" fill="${C.muted}">Tue 9:30</text>` +
      `<rect x="72" y="372" width="150" height="58" rx="13" fill="${C.green}"/><text x="147" y="410" font-size="24" font-weight="800" fill="${C.white}" text-anchor="middle">Done</text>` +
      `<rect x="236" y="372" width="170" height="58" rx="13" fill="${C.white}" stroke="${C.border}" stroke-width="2"/><text x="321" y="410" font-size="24" font-weight="800" fill="${C.navy}" text-anchor="middle">Snooze</text>` +
      `<rect x="420" y="372" width="140" height="58" rx="13" fill="${C.white}" stroke="${C.border}" stroke-width="2"/><text x="490" y="410" font-size="24" font-weight="800" fill="${C.navy}" text-anchor="middle">Edit</text>`) +
      tap(321, 401) +
      caption(1, "Tap Snooze on any task"),
    wrapCard(220, 380,
      `<text x="72" y="290" font-size="28" font-weight="800" fill="${C.navy}">Remind me again…</text>` +
      ["This evening", "Tomorrow morning", "This weekend", "Next week"].map((o, i) =>
        `<rect x="72" y="${320 + i * 64}" width="576" height="52" rx="12" fill="${i === 1 ? C.greenTint : C.bg}"/>` +
        `<text x="96" y="${356 + i * 64}" font-size="26" font-weight="700" fill="${C.navy}">${o}</text>`,
      ).join("")) +
      tap(360, 410) +
      caption(2, "Pick when to be nudged again"),
    taskCard(360, "Dentist check-up", "snoozed → tomorrow morning", "TOMORROW", C.green) +
      caption(3, "It steps aside until then"),
  ]),

  // ---- Snap a photo ----
  "snap-photo": build([
    wrapCard(200, 300,
      `<text x="72" y="262" font-size="26" font-weight="700" fill="${C.muted}">Capture anything…</text>` +
      `<rect x="72" y="288" width="270" height="76" rx="14" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>` +
      `<text x="207" y="334" font-size="26" font-weight="800" fill="${C.navy}" text-anchor="middle">📷 Photo</text>` +
      `<rect x="360" y="288" width="288" height="76" rx="14" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>` +
      `<text x="504" y="334" font-size="26" font-weight="800" fill="${C.navy}" text-anchor="middle">🎙 Voice</text>` +
      `<rect x="72" y="400" width="576" height="60" rx="12" fill="${C.bg}"/><text x="92" y="438" font-size="24" fill="${C.faint}">snap a letter, bill or flyer…</text>`) +
      tap(207, 326) +
      caption(1, "Snap a letter, bill or flyer"),
    `<rect x="200" y="220" width="320" height="380" rx="16" fill="${C.white}" stroke="${C.border}" stroke-width="3"/>` +
      `<text x="230" y="290" font-size="24" font-weight="800" fill="${C.greenDk}">OAKWOOD PRIMARY</text>` +
      `<line x1="230" y1="320" x2="490" y2="320" stroke="${C.border}" stroke-width="2"/>` +
      ["PE kit — Friday", "Trip — £15 by 15 Jun", "Parents' eve: book"].map((l, i) =>
        `<text x="230" y="${370 + i * 50}" font-size="24" fill="${C.navy}">${l}</text>`).join("") +
      reading(650) + caption(2, "Nudge reads the photo"),
    taskCard(300, "Bring PE kit", "Reminder before school", "FRI", C.green) +
      taskCard(470, "Pay £15 trip", "due 15 Jun", "15 JUN", C.amber) +
      caption(3, "Every action becomes a task"),
  ]),

  // ---- Mark done / undo ----
  "mark-done": build([
    wrapCard(220, 240,
      `<text x="72" y="300" font-size="32" font-weight="800" fill="${C.navy}">Pay water bill</text>` +
      `<text x="72" y="346" font-size="26" fill="${C.muted}">£42 · Fri</text>` +
      `<rect x="72" y="384" width="150" height="58" rx="13" fill="${C.green}"/><text x="147" y="422" font-size="24" font-weight="800" fill="${C.white}" text-anchor="middle">Done</text>` +
      `<rect x="236" y="384" width="170" height="58" rx="13" fill="${C.white}" stroke="${C.border}" stroke-width="2"/><text x="321" y="422" font-size="24" font-weight="800" fill="${C.navy}" text-anchor="middle">Snooze</text>` +
      `<rect x="420" y="384" width="140" height="58" rx="13" fill="${C.white}" stroke="${C.border}" stroke-width="2"/><text x="490" y="422" font-size="24" font-weight="800" fill="${C.navy}" text-anchor="middle">Edit</text>`) +
      tap(147, 413) + caption(1, "Tap Done when it's handled"),
    `<rect x="40" y="280" width="640" height="150" rx="20" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>` +
      `<circle cx="86" cy="336" r="20" fill="${C.green}"/>` + check(86, 336, C.white) +
      `<text x="124" y="346" font-size="32" font-weight="800" fill="${C.faint}">Pay water bill</text>` +
      `<line x1="124" y1="336" x2="356" y2="336" stroke="${C.faint}" stroke-width="3"/>` +
      `<rect x="498" y="318" width="142" height="52" rx="13" fill="none" stroke="${C.amber}" stroke-width="2"/><text x="569" y="352" font-size="24" font-weight="800" fill="${C.amber}" text-anchor="middle">Undo</text>` +
      caption(2, "It's marked done in a tap"),
    `<text x="360" y="380" font-size="30" font-weight="800" fill="${C.navy}" text-anchor="middle">Find it under “Closed nudges”</text>` +
      `<text x="360" y="428" font-size="26" fill="${C.muted}" text-anchor="middle">(in the menu) — Undo anytime</text>` +
      caption(3, "Changed your mind? Undo anytime"),
  ]),

  // ---- Edit a task's date ----
  "edit-date": build([
    wrapCard(220, 210,
      `<text x="72" y="300" font-size="32" font-weight="800" fill="${C.navy}">Dentist check-up</text>` +
      `<text x="72" y="346" font-size="26" fill="${C.muted}">Tue 9:30</text>` +
      `<rect x="468" y="372" width="142" height="58" rx="13" fill="${C.white}" stroke="${C.border}" stroke-width="2"/><text x="539" y="410" font-size="24" font-weight="800" fill="${C.navy}" text-anchor="middle">Edit</text>`) +
      tap(539, 401) + caption(1, "Tap Edit on any task"),
    wrapCard(200, 430,
      `<text x="72" y="258" font-size="24" font-weight="700" fill="${C.muted}">Name</text>` +
      `<rect x="72" y="276" width="576" height="58" rx="12" fill="${C.bg}"/><text x="92" y="314" font-size="26" font-weight="700" fill="${C.navy}">Dentist check-up</text>` +
      `<text x="72" y="388" font-size="24" font-weight="700" fill="${C.muted}">Date</text>` +
      `<rect x="72" y="406" width="280" height="60" rx="12" fill="${C.white}" stroke="${C.green}" stroke-width="3"/><text x="92" y="446" font-size="26" font-weight="700" fill="${C.navy}">Wed 11 Jun</text>` +
      `<text x="372" y="388" font-size="24" font-weight="700" fill="${C.muted}">Time</text>` +
      `<rect x="372" y="406" width="180" height="60" rx="12" fill="${C.white}" stroke="${C.border}" stroke-width="2"/><text x="392" y="446" font-size="26" font-weight="700" fill="${C.navy}">14:00</text>` +
      `<rect x="72" y="512" width="200" height="64" rx="14" fill="${C.green}"/><text x="172" y="554" font-size="26" font-weight="800" fill="${C.white}" text-anchor="middle">Save</text>`) +
      tap(172, 544) + caption(2, "Change the name, date or time"),
    taskCard(320, "Dentist check-up", "moved to Wed 14:00", "WED", C.green) +
      caption(3, "Saved — its reminders update too"),
  ]),

  // ---- Share with family ----
  "share-family": build([
    wrapCard(200, 320,
      `<text x="72" y="262" font-size="24" font-weight="800" fill="${C.muted}" letter-spacing="1">THE PEARCES</text>` +
      `<rect x="72" y="286" width="576" height="62" rx="12" fill="${C.bg}"/><text x="96" y="326" font-size="26" font-weight="800" fill="${C.navy}">Adam (you)</text>` +
      `<rect x="72" y="362" width="576" height="62" rx="12" fill="${C.bg}"/><text x="96" y="402" font-size="26" font-weight="800" fill="${C.navy}">Bev</text>` +
      `<rect x="408" y="452" width="240" height="58" rx="14" fill="${C.green}"/><text x="528" y="490" font-size="24" font-weight="800" fill="${C.white}" text-anchor="middle">Invite someone</text>`) +
      caption(1, "Invite your household to Family"),
    wrapCard(240, 220,
      `<text x="72" y="312" font-size="32" font-weight="800" fill="${C.navy}">Pay nursery fees</text>` +
      `<text x="72" y="358" font-size="26" fill="${C.muted}">£120 · Fri</text>` +
      `<text x="378" y="314" font-size="24" fill="${C.muted}">Assigned to</text>` +
      `<rect x="378" y="332" width="200" height="60" rx="13" fill="${C.bg}"/><text x="402" y="372" font-size="26" font-weight="800" fill="${C.navy}">Bev ▾</text>`) +
      tap(478, 362) + caption(2, "Assign who's doing it"),
    taskCard(320, "Pay nursery fees", "shared · for Bev", "FRI", C.amber) +
      `<text x="360" y="520" font-size="26" fill="${C.muted}" text-anchor="middle">Everyone in the family gets the nudge.</text>` +
      caption(3, "The whole household stays in sync"),
  ]),
};

const out = join(process.cwd(), "public", "guides");
mkdirSync(out, { recursive: true });
for (const [name, svg] of Object.entries(guides)) {
  writeFileSync(join(out, `${name}.svg`), svg);
  console.log("  wrote", `${name}.svg`);
}
console.log("Done → public/guides/");
