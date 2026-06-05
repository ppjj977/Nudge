/**
 * The nudge mark: a calm green arc cradling an amber "nudge dot", with three
 * little amber nudge lines. For use on light backgrounds.
 */
export default function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      {/* arc / cradle */}
      <path
        d="M32.4 75.8 A29 29 0 1 1 65.6 75.8"
        stroke="#7BAA94"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {/* nudge dot */}
      <circle cx="49" cy="56" r="8" fill="#F5B52E" />
      {/* nudge lines */}
      <g stroke="#F5B52E" strokeWidth="4.2" strokeLinecap="round">
        <path d="M70 30 L75 18" />
        <path d="M78 27 L84 14" />
        <path d="M85 32 L95 25" />
      </g>
    </svg>
  );
}
