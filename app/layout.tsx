import type { Metadata } from "next";
import "./globals.css";

// Branding deliberately deferred (SPEC top matter) — codename only.
const APP_NAME = process.env.APP_NAME ?? "relay";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Capture-first life admin. Forward it, we'll find the to-dos.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <span className="wordmark">{APP_NAME}</span>
          <span className="tagline">life admin, captured</span>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
