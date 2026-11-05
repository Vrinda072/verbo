import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { cancel, handleApproval } from "@/lib/transfers/service";
import { getTransferByOrder } from "@/lib/store/transfers";
import { log } from "@/lib/log";

export const metadata = { title: "PayPal", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * PayPal sends the payer back here (return_url / cancel_url) with ?token=<order id>.
 * Approved → authorize (and hold if risky) → the transfer status screen.
 * Cancelled → mark the transfer cancelled; nothing was authorized, so nothing moved.
 * Orders not created by the app (e.g. scripts/money-loop) just get a thank-you page.
 */
export default async function PayPalReturn({ searchParams }: { searchParams: Promise<{ cancelled?: string; token?: string }> }) {
  const { cancelled, token } = await searchParams;
  let target: string | null = null;

  if (token) {
    try {
      if (cancelled) {
        const t = await getTransferByOrder(token);
        if (t) target = `/send/t/${(await cancel(t.id)).id}`;
      } else {
        const t = await handleApproval(token);
        if (t) target = `/send/t/${t.id}`;
      }
    } catch (err) {
      log.error("paypal return failed", { message: (err as Error).message });
    }
  }
  if (target) redirect(target);

  return (
    <main id="main" className="px-4 py-16">
      {cancelled ? (
        <EmptyState title="Payment not approved" body="Nothing was sent. You can close this tab." />
      ) : (
        <EmptyState
          eyebrow="Sandbox"
          title="Thank you — approval received"
          body="You can close this tab and go back to Verbo. Nothing more is needed here."
        />
      )}
    </main>
  );
}
