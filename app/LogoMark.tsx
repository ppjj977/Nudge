/**
 * The nudge mark: a green disc with a white "n" inside an amber sun-burst.
 * For use on light backgrounds. Kept in sync with assets/ (see gen-brand.ts).
 */
const GREEN = "#7BAA94";
const AMBER = "#F5B52E";

const R = 20;
const INNER = R + R * 0.36;
const OUTER = R + R * 0.92;
const RAYS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * 2 * Math.PI;
  return {
    x1: 50 + INNER * Math.cos(a),
    y1: 50 + INNER * Math.sin(a),
    x2: 50 + OUTER * Math.cos(a),
    y2: 50 + OUTER * Math.sin(a),
  };
});

export default function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g stroke={AMBER} strokeWidth="4" strokeLinecap="round">
        {RAYS.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
        ))}
      </g>
      <circle cx="50" cy="50" r={R} fill={GREEN} />
      <text
        x="50"
        y="60.5"
        fontFamily="Manrope, Arial, sans-serif"
        fontSize="30"
        fontWeight="800"
        fill="#FFFFFF"
        textAnchor="middle"
      >
        n
      </text>
    </svg>
  );
}
