"use client";

/** Last-resort boundary if the root layout itself throws. */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "48px 20px",
          color: "#232a32",
          background: "#f8f7f4",
        }}
      >
        <h1 style={{ color: "#7baa94" }}>nudge</h1>
        <p>Something went wrong. Please try again.</p>
        <button
          onClick={() => reset()}
          style={{
            background: "#7baa94",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "11px 20px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
