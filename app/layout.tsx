import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

/** Figtree: a clean geometric sans with clear numerals. Other scripts fall back to Noto. */
const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${APP_NAME}: voice payments with safety checks`, template: `%s · ${APP_NAME}` },
  description:
    "Voice payments on PayPal with read-back in the sender's language, recipient and risk checks, and recovery for payments sent to the wrong person.",
};

export const viewport: Viewport = {
  themeColor: "#001c64",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="min-h-dvh bg-paper text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-v focus:bg-card focus:px-4 focus:py-2 focus:shadow-v"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
