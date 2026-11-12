import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { publicView, tick } from "@/lib/transfers/service";
import { TransferStatus } from "./TransferStatus";
import { caseForTransfer } from "@/lib/recovery/service";

export const metadata = { title: "Your payment", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await tick(id);
  if (!t) notFound();
  return (
    <>
      <SiteHeader />
      <main id="main" className="px-4 py-10 sm:py-14">
        <TransferStatus initial={publicView(t)} caseId={(await caseForTransfer(t.id))?.id ?? null} />
      </main>
    </>
  );
}
