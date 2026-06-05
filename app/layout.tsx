import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import Link from "next/link";
import LogoMark from "./LogoMark";
import SWRegister from "./SWRegister";
import NativePush from "./NativePush";
import NativeExtras from "./NativeExtras";
import PullToRefresh from "./PullToRefresh";
import Menu from "./Menu";
import { getCurrentUser } from "@/lib/auth";
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
  themeColor: "#7BAA94",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={manrope.className}>
      <body>
        <SWRegister />
        {user && <NativePush />}
        {user && <NativeExtras />}
        {user && <PullToRefresh />}
        <header className="topbar">
          <Link href="/" className="brand">
            <LogoMark size={28} />
            <span className="wordmark">{APP_NAME}</span>
          </Link>
          {user ? (
            <Menu userName={user.name} userEmail={user.email} />
          ) : (
            <nav className="auth-nav">
              <Link href="/login" className="auth-nav-link">
                Sign in
              </Link>
              <Link href="/signup" className="auth-nav-cta">
                Get started
              </Link>
            </nav>
          )}
        </header>
        <main className="container">{children}</main>
        <footer className="tagline-footer">
          <div>a gentle nudge for everything that matters</div>
          <div className="footer-links">
            <Link href="/privacy">Privacy</Link>
            <span aria-hidden="true">·</span>
            <Link href="/terms">Terms</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
