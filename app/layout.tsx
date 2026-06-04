import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import Link from "next/link";
import LogoMark from "./LogoMark";
import SWRegister from "./SWRegister";
import Menu from "./Menu";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], display: "swap" });

// Brand name. Overridable via APP_NAME; defaults to the product name "nudge".
const APP_NAME = process.env.APP_NAME ?? "nudge";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "A gentle nudge for everything that matters.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon-32.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0D1B2A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={manrope.className}>
      <body>
        <SWRegister />
        <header className="topbar">
          <Link href="/" className="brand">
            <LogoMark size={28} />
            <span className="wordmark">{APP_NAME}</span>
          </Link>
          <Menu />
        </header>
        <main className="container">{children}</main>
        <footer className="tagline-footer">
          a gentle nudge for everything that matters
        </footer>
      </body>
    </html>
  );
}
