import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Arabic, Noto_Sans_Devanagari, Noto_Sans_Display, Noto_Sans_Telugu } from "next/font/google";
import { APP_NAME } from "@/lib/core/config";
import "./globals.css";

/** One type family across the scripts Verbo reads back in, so Hindi, Telugu, Arabic and Latin text sit together. */
const noto = Noto_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-noto", display: "swap" });
const notoDisplay = Noto_Sans_Display({ subsets: ["latin", "latin-ext"], weight: ["600", "700"], variable: "--font-noto-display", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", display: "swap" });
const telu = Noto_Sans_Telugu({ subsets: ["telugu"], variable: "--font-telu", display: "swap" });
const arab = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arab", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${APP_NAME}: voice payments with safety checks`, template: `%s · ${APP_NAME}` },
  description:
    "Voice payments on PayPal with read-back in the sender's language, recipient and risk checks, and recovery for payments sent to the wrong person.",
};

export const viewport: Viewport = {
  themeColor: "#071a4d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${noto.variable} ${notoDisplay.variable} ${deva.variable} ${telu.variable} ${arab.variable}`}>
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
