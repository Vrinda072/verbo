import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Fraunces } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

/** Atkinson Hyperlegible: designed for low-vision readers — fits Verbo's audience. */
const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});

/** Fraunces: warm display serif for headings and the big confirmation digits. */
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — send safely, in your language`, template: `%s · ${APP_NAME}` },
  description:
    "A voice-first safety net for person-to-person payments: speak in your language, catch look-alike recipients, and recover mistaken payments across language barriers.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#16140f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${atkinson.variable} ${fraunces.variable}`}>
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
