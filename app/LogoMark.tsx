/** The nudge "N + forward path + dot" mark, for use on light backgrounds. */
export default function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M150 312 C 214 372 296 212 372 270"
        stroke="#22C1A2"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray="2 28"
        opacity="0.8"
      />
      <path
        d="M150 364 L150 158 L356 364 L356 158"
        stroke="#0D1B2A"
        strokeWidth="44"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="392" cy="150" r="54" fill="#22C1A2" opacity="0.22" />
      <circle cx="392" cy="150" r="30" fill="#22C1A2" />
    </svg>
  );
}
