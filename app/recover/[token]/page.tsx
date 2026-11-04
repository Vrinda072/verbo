import { EmptyState } from "@/components/EmptyState";

export const metadata = { title: "Money sent to you by mistake", robots: { index: false } };

export default async function RecoverPage({ params }: { params: Promise<{ token: string }> }) {
  await params; // token verification lands on Day 4
  return (
    <main id="main" className="px-4 py-16">
      <EmptyState
        eyebrow="Arriving Day 4"
        title="Someone sent you money by mistake"
        body="This page will explain what happened in your language and let you send it back with one tap."
      />
    </main>
  );
}
