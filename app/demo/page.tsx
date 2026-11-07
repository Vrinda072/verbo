import { SiteHeader } from "@/components/SiteHeader";
import { DemoStage } from "./DemoStage";

export const metadata = { title: "Walkthrough" };

export default function DemoPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <DemoStage />
      </main>
    </>
  );
}
