import { SiteHeader } from "@/components/SiteHeader";
import { EmptyState } from "@/components/EmptyState";

export const metadata = { title: "Send" };

export default function SendPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="px-4 py-16">
        <EmptyState
          eyebrow="Arriving Day 2"
          title="Send by voice"
          body="Tap the microphone, say who and how much in your language, and confirm on a large, clear card."
          action={{ href: "/", label: "Back home" }}
        />
      </main>
    </>
  );
}
