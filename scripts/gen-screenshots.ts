/**
 * Generate the landing-page / Play-store app screenshots as branded 1080×1920
 * mockups (Brand Guidelines v1.0: leaf mark, Inter, navy/green/amber). These
 * stand in for live device captures so the marketing stays on-brand without a
 * device. Run: npx tsx scripts/gen-screenshots.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const W = 1080;
const H = 1920;

const C = {
  navy: "#232A32",
  green: "#7BAA94",
  greenDk: "#3C5A4C",
  mint: "#CFE0D5",
  amber: "#F5B52E",
  bg: "#F8F7F4",
  panel: "#FFFFFF",
  text: "#232A32",
  muted: "#667085",
  faint: "#9AA4AE",
  border: "#E9E9E3",
  fieldBg: "#F5F6F7",
  tagBg: "#E9F0EB",
  forBg: "#FDF3DE",
  forText: "#8A6516",
  bannerBg: "#FCEFD0",
  reviewTab: "#463A0F",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ----------------------------- shared chrome ----------------------------- */
function leafPath(x: number, y: number, s: number): string {
  const r = s / 2;
  return (
    `M ${x} ${y} L ${x + r} ${y} A ${r} ${r} 0 0 1 ${x + s} ${y + r} ` +
    `L ${x + s} ${y + s} L ${x + r} ${y + s} A ${r} ${r} 0 0 1 ${x} ${y + r} Z`
  );
}
function leafMark(tx: number, ty: number, k: number): string {
  const inner =
    `<path d="${leafPath(16, 16, 68)}" fill="none" stroke="${C.green}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<text x="45" y="64" font-size="44" font-weight="700" fill="${C.navy}" text-anchor="middle">n</text>` +
    `<circle cx="64" cy="59" r="5.5" fill="${C.amber}"/>`;
  return `<g transform="translate(${tx},${ty}) scale(${k})">${inner}</g>`;
}

/** Status bar + topbar (leaf + wordmark + burger) + footer tagline. */
function chrome(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, Arial, sans-serif">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <!-- status bar -->
  <text x="56" y="62" font-size="38" font-weight="700" fill="${C.navy}">9:41</text>
  <rect x="936" y="34" width="46" height="26" rx="7" fill="${C.navy}"/>
  <rect x="992" y="28" width="56" height="32" rx="9" fill="${C.navy}"/>
  <!-- topbar -->
  <rect x="0" y="90" width="${W}" height="98" fill="${C.panel}"/>
  <line x1="0" y1="188" x2="${W}" y2="188" stroke="${C.border}" stroke-width="2"/>
  ${leafMark(52, 110, 0.56)}
  <text x="132" y="153" font-size="42" font-weight="800" fill="${C.navy}" letter-spacing="-0.5">nudge</text>
  <g stroke="${C.navy}" stroke-width="5" stroke-linecap="round">
    <line x1="966" y1="124" x2="1016" y2="124"/>
    <line x1="966" y1="139" x2="1016" y2="139"/>
    <line x1="966" y1="154" x2="1016" y2="154"/>
  </g>
  ${body}
  <text x="${W / 2}" y="1872" font-size="27" fill="${C.faint}" text-anchor="middle">a gentle nudge for everything that matters</text>
</svg>`;
}

/* ------------------------------ primitives ------------------------------- */
function card(x: number, y: number, w: number, h: number, fill = C.panel): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${fill}" stroke="${C.border}" stroke-width="2"/>`;
}
type Tab = { label: string; on?: boolean; badge?: string; tone?: "navy" | "review" };
function tabs(x: number, y: number, items: Tab[]): string {
  let cx = x;
  const out: string[] = [];
  for (const t of items) {
    const w = t.label.length * 20 + 64;
    const fill = t.on ? (t.tone === "review" ? C.reviewTab : C.navy) : C.panel;
    const tc = t.on ? C.panel : C.muted;
    const stroke = t.on ? "none" : C.border;
    out.push(
      `<rect x="${cx}" y="${y}" width="${w}" height="72" rx="36" fill="${fill}" ${stroke === "none" ? "" : `stroke="${stroke}" stroke-width="2"`}/>` +
        `<text x="${cx + w / 2}" y="${y + 47}" font-size="32" font-weight="700" fill="${tc}" text-anchor="middle">${esc(t.label)}</text>`,
    );
    if (t.badge) {
      out.push(
        `<circle cx="${cx + w - 6}" cy="${y + 6}" r="20" fill="${C.amber}"/>` +
          `<text x="${cx + w - 6}" y="${y + 16}" font-size="26" font-weight="800" fill="${C.navy}" text-anchor="middle">${esc(t.badge)}</text>`,
      );
    }
    cx += w + 16;
  }
  return out.join("\n  ");
}
type ChipKind = "tag" | "mint" | "for" | "sure";
function chip(x: number, y: number, label: string, kind: ChipKind): string {
  const w = label.length * 17 + 48;
  const map = {
    tag: { fill: C.tagBg, stroke: "none", tc: C.greenDk },
    mint: { fill: C.mint, stroke: "none", tc: "#2F4A3C" },
    for: { fill: C.forBg, stroke: C.amber, tc: C.forText },
    sure: { fill: C.forBg, stroke: C.amber, tc: C.forText },
  }[kind];
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="56" rx="28" fill="${map.fill}" ${map.stroke === "none" ? "" : `stroke="${map.stroke}" stroke-width="2"`}/>` +
    `<text x="${x + w / 2}" y="${y + 37}" font-size="27" font-weight="700" fill="${map.tc}" text-anchor="middle">${esc(label)}</text>`
  );
}
/** Button that returns its SVG and its width so callers can advance a cursor. */
function button(x: number, y: number, label: string, primary = false): { svg: string; w: number } {
  const w = label.length * 18 + 56;
  return {
    w,
    svg:
      `<rect x="${x}" y="${y}" width="${w}" height="64" rx="14" fill="${primary ? C.green : C.panel}" ${primary ? "" : `stroke="${C.border}" stroke-width="2"`}/>` +
      `<text x="${x + w / 2}" y="${y + 42}" font-size="30" font-weight="700" fill="${primary ? C.panel : C.navy}" text-anchor="middle">${esc(label)}</text>`,
  };
}
function actions(x: number, y: number, labels: [string, ...string[]]): string {
  let cx = x;
  const parts: string[] = [];
  labels.forEach((l, i) => {
    const b = button(cx, y, l, i === 0);
    parts.push(b.svg);
    cx += b.w + 14;
  });
  return parts.join("\n    ");
}

/* ------------------------------- screens --------------------------------- */
function taskCard(y: number, title: string, chips: [string, ChipKind][], meta: string): string {
  let cx = 88;
  const chipSvg = chips
    .map(([l, k]) => {
      const s = chip(cx, y + 96, l, k);
      cx += l.length * 17 + 48 + 14;
      return s;
    })
    .join("\n    ");
  return (
    card(56, y, 968, 200) +
    `<text x="88" y="${y + 70}" font-size="40" font-weight="800" fill="${C.text}">${esc(title)}</text>` +
    chipSvg +
    `<text x="88" y="${y + 184}" font-size="30" fill="${C.muted}">${esc(meta)}</text>` +
    actions(640, y + 132, ["Done", "Snooze", "Edit"])
  );
}

function timeline(): string {
  const cap =
    card(56, 360, 968, 280) +
    `<text x="88" y="430" font-size="32" font-weight="700" fill="${C.text}">drop in the things you've got to deal with.</text>` +
    `<rect x="88" y="456" width="904" height="92" rx="14" fill="${C.fieldBg}"/>` +
    `<text x="112" y="500" font-size="28" fill="${C.faint}">Paste an email, a message — anything.</text>` +
    `<text x="112" y="534" font-size="28" fill="${C.faint}">Or add a photo or voice note below.</text>` +
    (() => {
      let cx = 88;
      const labels: [string, boolean][] = [["Capture", true], ["Upload image", false], ["Voice note", false]];
      return labels
        .map(([l, p]) => {
          const b = button(cx, 568, l, p);
          cx += b.w + 16;
          return b.svg;
        })
        .join("\n  ");
    })();
  const body =
    `<text x="56" y="290" font-size="58" font-weight="800" fill="${C.text}">Good morning, Adam</text>` +
    `<text x="56" y="336" font-size="30" fill="${C.muted}">Here's your day.</text>` +
    cap +
    tabs(56, 690, [{ label: "Today", on: true }, { label: "This week" }, { label: "Later" }, { label: "Money" }]) +
    `<rect x="56" y="800" width="968" height="76" rx="16" fill="${C.bannerBg}" stroke="${C.amber}" stroke-width="2"/>` +
    `<text x="88" y="848" font-size="30" font-weight="700" fill="${C.forText}">2 things need a quick look →</text>` +
    taskCard(916, "Bring PE kit", [["prepare", "tag"], ["school", "tag"]], "Fri 12 Jun") +
    taskCard(1140, "Pay water bill", [["pay", "tag"], ["money", "tag"]], "£42.18 · Sun 28 Jun") +
    taskCard(1364, "Book dentist check-up", [["book", "tag"], ["health", "tag"]], "by Tue 16 Jun") +
    taskCard(1588, "Send Dana the proposal", [["send", "tag"], ["work", "tag"]], "Wed 17 Jun");
  return chrome(body);
}

function calendar(): string {
  const cols = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const gx = 56,
    gy = 470,
    cw = 138,
    ch = 224;
  let cells = "";
  // weekday header
  cols.forEach((d, i) => {
    cells += `<text x="${gx + i * cw + 18}" y="450" font-size="28" font-weight="700" fill="${C.muted}">${d}</text>`;
  });
  // 1 Jun 2026 is a Monday → column 0.
  for (let day = 1; day <= 30; day++) {
    const idx = day - 1;
    const col = idx % 7;
    const row = Math.floor(idx / 7);
    const x = gx + col * cw;
    const y = gy + row * ch;
    cells += card(x + 6, y + 6, cw - 12, ch - 12);
    cells += `<text x="${x + 24}" y="${y + 48}" font-size="30" font-weight="700" fill="${day <= 30 ? C.navy : C.faint}">${day}</text>`;
  }
  // event chips
  cells += `<rect x="${gx + 4 * cw + 18}" y="${gy + 56}" width="116" height="44" rx="10" fill="${C.fieldBg}"/><text x="${gx + 4 * cw + 32}" y="${gy + 86}" font-size="26" font-weight="700" fill="${C.text}">PE kit</text>`;
  cells += `<rect x="${gx + 6 * cw + 18}" y="${gy + 2 * ch + 56}" width="110" height="44" rx="10" fill="${C.fieldBg}"/><text x="${gx + 6 * cw + 32}" y="${gy + 2 * ch + 86}" font-size="26" font-weight="700" fill="${C.text}">Bins</text>`;
  // Cornwall holiday spanning week of 8–14 (row 1)
  cells += `<rect x="${gx + 4}" y="${gy + ch + 56}" width="${cw * 7 - 8}" height="52" rx="12" fill="${C.mint}"/><text x="${gx + 28}" y="${gy + ch + 92}" font-size="30" font-weight="800" fill="${C.greenDk}">Cornwall holiday</text>`;
  const body =
    `<text x="56" y="300" font-size="58" font-weight="800" fill="${C.text}">Calendar</text>` +
    `<text x="${W / 2}" y="400" font-size="44" font-weight="800" fill="${C.text}" text-anchor="middle">June 2026</text>` +
    cells;
  return chrome(body);
}

function reviewScreen(): string {
  function reviewCard(y: number, title: string, sure: string, quote: string): string {
    return (
      card(56, y, 968, 280) +
      `<text x="88" y="${y + 68}" font-size="40" font-weight="800" fill="${C.text}">${esc(title)}</text>` +
      chip(88, y + 96, "attend", "tag") +
      chip(240, y + 96, sure, "sure") +
      `<rect x="88" y="${y + 168}" width="6" height="44" rx="3" fill="${C.green}"/>` +
      `<text x="112" y="${y + 200}" font-size="30" fill="${C.muted}">${esc(quote)}</text>` +
      actions(88, y + 232, ["Approve", "Edit", "Dismiss"])
    );
  }
  const body =
    `<text x="56" y="300" font-size="58" font-weight="800" fill="${C.text}">Good evening, Adam</text>` +
    tabs(56, 360, [{ label: "Today" }, { label: "This week" }, { label: "Needs review", on: true, tone: "review" }]) +
    `<rect x="56" y="470" width="968" height="116" rx="18" fill="${C.bannerBg}" stroke="${C.amber}" stroke-width="2"/>` +
    `<text x="88" y="528" font-size="34" font-weight="800" fill="${C.forText}">Nudge wasn't sure about these.</text>` +
    `<text x="88" y="568" font-size="30" fill="${C.forText}">Approve, edit, or dismiss.</text>` +
    reviewCard(620, "Spa Pamper Party", "~55% sure", "“…booked for 14 June at 2pm…”") +
    reviewCard(924, "Parents' evening", "~48% sure", "“…booking now open for slots…”");
  return chrome(body);
}

function familyScreen(): string {
  const member = (y: number, name: string, role: string) =>
    `<rect x="88" y="${y}" width="904" height="92" rx="14" fill="${C.fieldBg}"/>` +
    `<text x="120" y="${y + 58}" font-size="36" font-weight="800" fill="${C.text}">${esc(name)}</text>` +
    `<rect x="${992 - 24 - (role.length * 16 + 36)}" y="${y + 24}" width="${role.length * 16 + 36}" height="44" rx="22" fill="${C.panel}" stroke="${C.border}" stroke-width="2"/>` +
    `<text x="${992 - 24 - (role.length * 16 + 36) / 2}" y="${y + 53}" font-size="26" font-weight="700" fill="${C.muted}" text-anchor="middle">${esc(role)}</text>`;
  const body =
    `<text x="56" y="288" font-size="30" font-weight="700" fill="${C.green}">← Timeline</text>` +
    `<text x="56" y="356" font-size="58" font-weight="800" fill="${C.text}">Family</text>` +
    card(56, 400, 968, 432) +
    `<text x="88" y="458" font-size="28" font-weight="800" fill="${C.muted}" letter-spacing="1">THE PEARCES</text>` +
    member(484, "Adam Pearce (you)", "owner") +
    member(590, "Bev Pearce", "member") +
    member(696, "Sam", "member") +
    card(56, 868, 968, 312) +
    `<text x="88" y="926" font-size="28" font-weight="800" fill="${C.muted}" letter-spacing="1">INVITE SOMEONE</text>` +
    `<text x="88" y="980" font-size="30" font-weight="700" fill="${C.text}">Their email</text>` +
    `<rect x="88" y="1000" width="904" height="80" rx="14" fill="${C.fieldBg}"/>` +
    `<text x="120" y="1050" font-size="32" fill="${C.text}">bev@example.com</text>` +
    button(88, 1100, "Send invite", true).svg +
    card(56, 1216, 968, 132) +
    button(88, 1250, "Leave family", false).svg;
  return chrome(body);
}

function familyTab(): string {
  function fcard(y: number, title: string, chips: [string, ChipKind][], meta: string, who: string): string {
    let cx = 88;
    const chipSvg = chips
      .map(([l, k]) => {
        const s = chip(cx, y + 96, l, k);
        cx += l.length * 17 + 48 + 14;
        return s;
      })
      .join("\n    ");
    return (
      card(56, y, 968, 224) +
      `<text x="88" y="${y + 70}" font-size="40" font-weight="800" fill="${C.text}">${esc(title)}</text>` +
      chipSvg +
      `<text x="88" y="${y + 188}" font-size="30" fill="${C.muted}">${esc(meta)}</text>` +
      `<text x="620" y="${y + 142}" font-size="30" fill="${C.muted}">Assigned to</text>` +
      `<rect x="800" y="${y + 108}" width="194" height="64" rx="14" fill="${C.fieldBg}"/>` +
      `<text x="828" y="${y + 150}" font-size="30" font-weight="700" fill="${C.text}">${esc(who)}</text>` +
      `<text x="966" y="${y + 150}" font-size="26" fill="${C.muted}">▾</text>`
    );
  }
  const body =
    `<text x="56" y="290" font-size="58" font-weight="800" fill="${C.text}">Good morning, Adam</text>` +
    tabs(56, 360, [{ label: "Today" }, { label: "Later" }, { label: "Family", on: true, badge: "3" }, { label: "Money" }]) +
    `<text x="56" y="492" font-size="30" fill="${C.muted}">Shared with your family — anyone can tick these off,</text>` +
    `<text x="56" y="532" font-size="30" fill="${C.muted}">and everyone gets the nudge.</text>` +
    fcard(580, "Pay nursery fees", [["pay", "tag"], ["you", "mint"], ["for Adam", "for"]], "£120 · Fri 12 Jun", "Adam") +
    fcard(828, "Book the MOT", [["book", "tag"], ["Bev", "mint"], ["for Bev", "for"]], "by Tue 16 Jun", "Bev") +
    fcard(1076, "Cornwall holiday", [["trip", "tag"], ["you", "mint"], ["for Bev", "for"]], "Sat 8 – Sun 14 Jun", "Bev");
  return chrome(body);
}

/* -------------------------------- write ---------------------------------- */
const out = join(process.cwd(), "public/screenshots");
mkdirSync(out, { recursive: true });
const screens: [string, string][] = [
  ["timeline", timeline()],
  ["calendar", calendar()],
  ["review", reviewScreen()],
  ["family", familyScreen()],
  ["family-tab", familyTab()],
];
for (const [name, svg] of screens) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
  writeFileSync(join(out, `${name}.png`), png);
  console.log("  rendered", `${name}.png`);
}
console.log("Done → public/screenshots/");
