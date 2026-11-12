import { SiteHeader } from "@/components/ui/SiteHeader";
import { DemoStage } from "./DemoStage";
import { TrapExplorer } from "./TrapExplorer";

export const metadata = { title: "Examples" };

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ story?: string }> }) {
  const { story } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <TrapExplorer />
        <div className="mt-20">
          <DemoStage key={story ?? "default"} initialStory={story} />
        </div>
      </main>
    </>
  );
}
