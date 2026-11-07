import { SiteHeader } from "@/components/SiteHeader";
import { SendFlow } from "./SendFlow";
import { config } from "@/lib/config";

export const metadata = { title: "Send" };
export const dynamic = "force-dynamic";

export default function SendPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="px-4 py-10 sm:px-6 sm:py-14">
        <SendFlow holdMinutes={config.riskHoldMinutes} speechProvider={config.speechProvider} />
        <p className="mx-auto mt-16 max-w-3xl text-center text-sm text-ink-3">
          PayPal sandbox only. Contacts are simulated. No real money moves. {config.speechProvider === "recorder" ? "Your recording goes to Groq to be written down" : "Your browser’s speech service hears what you say"}, and the text may go to Google Gemini, whose free tier can use it to improve Google’s products. Do not enter real personal details.
        </p>
      </main>
    </>
  );
}
