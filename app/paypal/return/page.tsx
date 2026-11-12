import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { cancel, handleApproval } from "@/lib/transfers/service";
import { getTransferByOrder } from "@/lib/transfers/store";
import { log } from "@/lib/core/log";
import { caseIdForReturn, handleReturnApproval } from "@/lib/recovery/service";
import { signRecoveryToken } from "@/lib/recovery/token";

export const metadata = { title: "PayPal", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * PayPal sends the payer back here (return_url / cancel_url) with ?token=<order id>.
 * Approved → authorize (and hold if risky) → the transfer status screen.
 * Cancelled → mark the transfer cancelled; nothing was authorized, so nothing moved.
 * Return orders (wrong recipient paying back) → capture + payout to the sender → back to the recovery page.
 * Orders not created by the app (e.g. scripts/money-loop) just get a thank-you page.
 */
export default async function PayPalReturn({ searchParams }: { searchParams: Promise<{ cancelled?: string; token?: string }> }) {
  const { cancelled, token } = await searchParams;
  let target: string | null = null;

  if (token) {
    try {
      const t0 = await getTransferByOrder(token);
      if (t0?.meta.kind === "return") {
        // The wrong recipient approved (or backed out of) a return: send them back to their recovery page.
        const r = cancelled ? null : await handleReturnApproval(token);
        const caseId = r?.caseId ?? (await caseIdForReturn(t0.id));
        if (caseId) target = `/recover/${signRecoveryToken(caseId)}`;
      } else if (cancelled) {
        if (t0) target = `/send/t/${(await cancel(t0.id)).id}`;
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
          title="Approval received"
          body="You can close this tab and go back to Verbo. Nothing more is needed here."
        />
      )}
    </main>
  );
}
