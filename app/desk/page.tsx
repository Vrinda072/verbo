import { SiteHeader } from "@/components/SiteHeader";
import { EmptyState } from "@/components/EmptyState";

export const metadata = { title: "Case Desk" };

export default function DeskPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="px-4 py-16">
        <EmptyState
          eyebrow="Arriving Day 5"
          title="Case Desk"
          body="Every recovery case on one desk: translated timeline, quick actions and an evidence packet. Built on AG Grid."
        />
      </main>
    </>
  );
}
