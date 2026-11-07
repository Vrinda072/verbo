import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

/** Inter: clear at small sizes, with distinct numerals for amounts. Other scripts fall back to Noto or system fonts. */
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${APP_NAME}: voice payments with safety checks`, template: `%s · ${APP_NAME}` },
  description:
    "Voice payments on PayPal with read-back in the sender's language, recipient and risk checks, and recovery for payments sent to the wrong person.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1117" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
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
