/**
 * Simulated clock for recovery cases: sends the 24 h reminder and the 72 h escalation.
 *   npm run recovery-tick                # evaluate at the real current time (run on a schedule)
 *   npm run recovery-tick -- --at=+73h   # pretend it is 73 hours from now (demo)
 */
import "dotenv/config";
import { processTimers } from "@/lib/recovery/service";

const at = process.argv.find((a) => a.startsWith("--at="))?.split("=")[1];
const m = at && /^\+(\d+(?:\.\d+)?)h$/.exec(at);
const now = new Date(Date.now() + (m ? Number(m[1]) * 3_600_000 : 0));

processTimers(now)
  .then((done) => {
    console.log(`clock: ${now.toISOString()}${m ? " (simulated)" : ""}`);
    for (const d of done) console.log(`  ${d.caseId} → ${d.event}`);
    if (!done.length) console.log("  nothing due");
    process.exit(0);
  })
  .catch((e) => {
    console.error((e as Error).message);
    process.exit(1);
  });
