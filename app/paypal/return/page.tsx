import { EmptyState } from "@/components/EmptyState";

export const metadata = { title: "Approved", robots: { index: false } };

/** PayPal redirects the payer here after approving (return_url). The server picks up the
 *  approval by polling the order (scripts) or via the CHECKOUT.ORDER.APPROVED webhook (app). */
export default async function PayPalReturn({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
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
