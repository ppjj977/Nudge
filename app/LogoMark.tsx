/**
 * The nudge mark: a green leaf / speech-bubble outline holding an "n" with an
 * amber "nudge" dot (Brand Guidelines v1.0). Kept in sync with assets/ — see
 * scripts/gen-brand.ts. `tone="dark"` uses a cream "n" for navy backgrounds;
 * the default navy "n" suits the light in-app topbar.
 */
const GREEN = "#7BAA94";
const AMBER = "#F5B52E";
const NAVY = "#232A32";
const CREAM = "#ECE6D6";

/** Square with two opposite corners pointed, two rounded (matches gen-brand). */
function leafPath(x: number, y: number, s: number): string {
  const r = s / 2;
  return (
    `M ${x} ${y} L ${x + r} ${y} A ${r} ${r} 0 0 1 ${x + s} ${y + r} ` +
    `L ${x + s} ${y + s} L ${x + r} ${y + s} A ${r} ${r} 0 0 1 ${x} ${y + r} Z`
  );
}

export default function LogoMark({
  size = 30,
  tone = "light",
}: {
  size?: number;
  tone?: "light" | "dark";
}) {
  const nColor = tone === "dark" ? CREAM : NAVY;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path
        d={leafPath(16, 16, 68)}
        fill="none"
        stroke={GREEN}
        strokeWidth="8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <text
        x="45"
        y="64"
        fontFamily="Inter, system-ui, Arial, sans-serif"
        fontSize="44"
        fontWeight="700"
        fill={nColor}
        textAnchor="middle"
      >
        n
      </text>
      <circle cx="64" cy="59" r="5.5" fill={AMBER} />
    </svg>
  );
}
