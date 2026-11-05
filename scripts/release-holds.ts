/**
 * Releases risk holds whose window has ended, even if nobody has the status page open.
 * Run on a schedule (Render cron job, every minute) or by hand:
 *   npm run release-holds            # once
 *   npm run release-holds -- --loop  # every 30 s until stopped
 * Safe to run concurrently with the app: state updates are optimistic and PayPal calls are idempotent.
 */
import "dotenv/config";
import { dueHolds } from "@/lib/store/transfers";
import { tick } from "@/lib/transfers/service";

async function once() {
  const ids = await dueHolds();
  for (const id of ids) {
    const t = await tick(id);
    console.log(`${id} → ${t?.state}`);
  }
  if (!ids.length) console.log("no holds due");
}

async function main() {
  await once();
  if (process.argv.includes("--loop")) setInterval(() => void once(), 30_000);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
