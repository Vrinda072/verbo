import { SiteHeader } from "@/components/SiteHeader";
import { DemoStage } from "./DemoStage";

export const metadata = { title: "Examples" };

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ story?: string }> }) {
  const { story } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <DemoStage key={story ?? "default"} initialStory={story} />
      </main>
    </>
  );
}
