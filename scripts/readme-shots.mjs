/**
 * Captures the README images from a running Verbo (default http://localhost:3000) with headless Chrome over the
 * DevTools protocol, so they can be re-made after a UI change:
 *
 *   npm run dev            # in another terminal
 *   node scripts/readme-shots.mjs [baseUrl]
 *
 * Writes docs/img/*.png, plus docs/img/phone-demo.gif when ffmpeg is installed. Everything shown is simulated data.
 * Protocol: chromedevtools.github.io/devtools-protocol (Page.captureScreenshot, Emulation.setDeviceMetricsOverride).
 */
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = "docs/img";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "verbo-shots-"));
const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--headless=new", "--hide-scrollbars", "--no-first-run", "about:blank"], {
  stdio: "ignore",
});

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await connect());
await new Promise((r) => ws.once("open", r));
let seq = 0;
const pending = new Map();
ws.on("message", (m) => {
  const msg = JSON.parse(m.toString());
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const js = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;

async function viewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: width < 768 });
}
async function open(path, settle = 2500) {
  await send("Page.navigate", { url: BASE + path });
  for (let i = 0; i < 100 && (await js("document.readyState")) !== "complete"; i++) await sleep(100);
  // Hide the Next.js dev-mode badge.
  await js(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal { display: none !important; }"; document.head.append(s); })()`);
  await sleep(settle);
}
async function shot(file, selector) {
  let clip;
  if (selector) {
    const r = await js(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; e.scrollIntoView({block: "center"}); const b = e.getBoundingClientRect(); return {x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height}; })()`);
    if (!r) throw new Error(`not found: ${selector}`);
    await sleep(300);
    const pad = 16;
    clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + pad * 2, height: r.height + pad * 2, scale: 1 };
  }
  if (!clip) {
    await js("scrollTo(0, 0)");
    const v = await js("({width: innerWidth, height: innerHeight})");
    clip = { x: 0, y: 0, width: v.width, height: v.height, scale: 1 };
  }
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
  const path = join(OUT, file);
  await import("node:fs").then((fs) => fs.writeFileSync(path, Buffer.from(data, "base64")));
  console.log("wrote", path);
}
// Click the first button whose visible text includes `text`.
const click = (text, scope = "document") =>
  js(`(() => { const b = [...${scope}.querySelectorAll("button")].find(b => b.innerText.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true; })()`);
// Set a React-controlled field and fire the events React listens to.
const fill = (selector, value) =>
  js(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); const proto = e.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event("input", {bubbles: true})); return true; })()`);

try {
  await send("Page.enable");
  await send("Runtime.enable");

  // 1. Home hero, desktop, with the phone paused on the read-back.
  await viewport(1440, 900);
  await open("/");
  await click("Pause");
  await click("Check the read-back");
  await sleep(700);
  await shot("home-hero.png");

  // 2. Phone frames for the GIF: every screen in four languages.
  const langs = [
    ["English", "en"],
    ["Hindi", "hi"],
    ["Telugu", "te"],
    ["Arabic", "ar"],
  ];
  const steps = ["Speak", "Answer one question", "Check the read-back", "Sent"];
  let frame = 0;
  const frames = mkdtempSync(join(tmpdir(), "verbo-frames-"));
  for (const [name] of langs) {
    await js(`[...document.querySelectorAll("button[aria-pressed]")].find(b => b.innerText.includes(${JSON.stringify(name)})).click()`);
    for (const s of steps) {
      await js(`[...document.querySelectorAll("ol button")].find(b => b.innerText.includes(${JSON.stringify(s)})).click()`);
      await sleep(650);
      const r = await js(`(() => { const b = document.querySelector("figure").getBoundingClientRect(); return {x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height}; })()`);
      const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: r.x - 12, y: r.y - 12, width: r.width + 24, height: r.height + 24, scale: 1 } });
      await import("node:fs").then((fs) => fs.writeFileSync(join(frames, `f${String(frame++).padStart(2, "0")}.png`), Buffer.from(data, "base64")));
    }
  }
  // Keep the Arabic read-back as a still too.
  await js(`[...document.querySelectorAll("ol button")].find(b => b.innerText.includes("Check the read-back")).click()`);
  await sleep(700);
  await shot("phone-arabic.png", "figure");
  try {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "0.7", "-i", join(frames, "f%02d.png"), "-vf", "scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=none", "-loop", "0", join(OUT, "phone-demo.gif")]);
    console.log("wrote", join(OUT, "phone-demo.gif"));
  } catch (e) {
    console.warn("ffmpeg not available, skipped the GIF:", e.message);
  }
  rmSync(frames, { recursive: true, force: true });

  // 3. What gets checked.
  await shot("checks.png", 'section[aria-labelledby="checks"]');

  // 4. Send in Arabic: typed request, then the read-back card.
  await viewport(1280, 1000);
  await open("/send");
  await js(`document.querySelector('button[aria-haspopup="listbox"]').click()`);
  await sleep(300);
  await click("العربية", 'document.querySelector("[role=listbox]")');
  await sleep(500);
  await click("Type instead");
  await sleep(300);
  await fill("#transcript", "أرسل 30 دولارا إلى مانويل لوبيز");
  await sleep(200);
  await js(`document.querySelector("#transcript").form.requestSubmit()`);
  for (let i = 0; i < 60 && !(await js(`!!document.querySelector(".v-stage")`)); i++) await sleep(250);
  await sleep(800);
  await shot("send-readback-ar.png", "main section:has(.v-stage)");

  // 5. Pay a number that is one digit off a contact's.
  await open("/send");
  await click("Pay a phone number");
  await sleep(300);
  await fill('input[inputmode="tel"]', "+1 (408) 555-0139");
  await fill('input[inputmode="decimal"]', "60");
  await sleep(200);
  await js(`document.querySelector('input[inputmode="tel"]').form.requestSubmit()`);
  for (let i = 0; i < 40 && !(await js(`!!document.querySelector("#near-title")`)); i++) await sleep(250);
  await sleep(600);
  await shot("wrong-number.png", 'section[aria-labelledby="near-title"]');

  // 6. Examples and Case Desk.
  await viewport(1440, 900);
  await open("/demo", 3000);
  await shot("examples.png");
  await open("/desk", 6000);
  await shot("case-desk.png");
} finally {
  ws.close();
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
  if (!existsSync(join(OUT, "home-hero.png"))) process.exitCode = 1;
}
