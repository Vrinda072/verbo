import { SiteHeader } from "@/components/SiteHeader";
import { DeskApp } from "./DeskApp";

export const metadata = { title: "Case Desk" };

export default function DeskPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="px-4 py-8 sm:px-6">
        <DeskApp />
        <p className="mx-auto mt-10 max-w-7xl text-sm text-ink-3">
          Demo operator view — no login in this demo. PayPal sandbox only. Simulated cases are synthetic and marked “sim”.
        </p>
      </main>
    </>
  );
}
