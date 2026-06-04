import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

// Brand name. Overridable via APP_NAME; defaults to the product name "nudge".
const APP_NAME = process.env.APP_NAME ?? "nudge";

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
          <Link href="/" className="wordmark">
            {APP_NAME}
          </Link>
          <span className="tagline">life admin, captured</span>
          <Link href="/settings" className="nav-link">
            Settings
          </Link>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
