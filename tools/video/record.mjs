/**
 * Records the FlowMatrix demonstration from the RUNNING application (real screen capture, real data).
 *
 *   node record.mjs <work_dir> [clip,clip,...]
 *
 * Needs the backend on :8000 (use a fresh database), `npm run dev` on :5173, durations.json from voice.py and
 * internet access for the map scene. Writes <work>/frames/<clip>/*.jpg and <work>/timeline.json.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../frontend/package.json"));
const { chromium } = require("playwright-core");

const work = process.argv[2];
const APP = process.env.APP_URL ?? "http://127.0.0.1:5173";
const durations = JSON.parse(readFileSync(path.join(work, "durations.json"), "utf8"));
const VIEW = { width: 1536, height: 864 }, DSF = 1.5, GAP = 0.45;

const CURSOR = () => {
  const install = () => {
    if (document.getElementById("fm-cursor") || !document.body) return;
    const c = document.createElement("div");
    c.id = "fm-cursor";
    c.style.cssText = "position:fixed;left:-50px;top:-50px;z-index:2147483647;pointer-events:none;width:24px;height:24px";
    c.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 2 L4 20 L9 15.5 L12.2 22 L15.4 20.5 L12.3 14.2 L19 14 Z" fill="#111827" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const at = (e) => { c.style.left = e.clientX - 4 + "px"; c.style.top = e.clientY - 2 + "px"; };
    addEventListener("pointermove", at, true);
    addEventListener("mousemove", at, true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      r.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #22d3ee;z-index:2147483646;pointer-events:none;transition:transform .45s ease-out,opacity .45s ease-out;transform:scale(.3);opacity:1`;
      document.body.appendChild(r);
      requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transform = "scale(1.3)"; r.style.opacity = "0"; }));
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install); else install();
  if (document.documentElement) new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
};

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: [`--force-device-scale-factor=${DSF}`, "--hide-scrollbars"],
});
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
await context.addInitScript(CURSOR);
const page = await context.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(e.message));
page.on("dialog", (d) => d.accept());
const cdp = await context.newCDPSession(page);
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

/* ---------------------------------------------------------------- capture */
let clip = null;
cdp.on("Page.screencastFrame", async (f) => {
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  if (!clip) return;
  const file = `${String(clip.frames.length).padStart(5, "0")}.jpg`;
  writeFileSync(path.join(work, "frames", clip.name, file), Buffer.from(f.data, "base64"));
  clip.frames.push({ t: +(f.metadata.timestamp - clip.epoch).toFixed(3), file });
});
const now = () => Date.now() / 1000 - clip.epoch;

const timelinePath = path.join(work, "timeline.json");
const timeline = existsSync(timelinePath) ? JSON.parse(readFileSync(timelinePath, "utf8")) : { dsf: DSF, view: VIEW, clips: {} };

async function record(name, label, body) {
  mkdirSync(path.join(work, "frames", name), { recursive: true });
  clip = { name, label, epoch: Date.now() / 1000, frames: [], beats: [], camera: [], cuts: [] };
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 2304, maxHeight: 1296, everyNthFrame: 1 });
  await page.mouse.move(mouse.x + 1, mouse.y); // force a first frame
  await page.mouse.move(mouse.x, mouse.y);
  await sleep(0.5);
  await body();
  await sleep(0.4);
  clip.end = +now().toFixed(3);
  await cdp.send("Page.stopScreencast");
  await sleep(0.2);
  const { epoch, ...data } = clip;
  timeline.clips[name] = data;
  writeFileSync(timelinePath, JSON.stringify(timeline));
  console.log(`recorded ${name}: ${clip.end}s, ${clip.frames.length} frames`);
  clip = null;
}

/** One narration line: run the actions and keep recording at least as long as the line takes to say. */
async function beat(id, actions) {
  const start = now();
  clip.beats.push({ id, t: +start.toFixed(3) });
  if (actions) await actions();
  const rest = durations[id] + GAP - (now() - start);
  if (rest > 0) await sleep(rest);
}

/* ---------------------------------------------------------------- camera */
const wide = () => clip.camera.push({ t: +now().toFixed(3), rect: null });
async function focus(targets, pad = 24) {
  const boxes = [];
  for (const t of [targets].flat()) {
    const b = typeof t.boundingBox === "function" ? await t.boundingBox() : t;
    if (b) boxes.push(b);
  }
  if (!boxes.length) return;
  const x0 = Math.min(...boxes.map((b) => b.x)) - pad, y0 = Math.min(...boxes.map((b) => b.y)) - pad;
  const x1 = Math.max(...boxes.map((b) => b.x + b.width)) + pad, y1 = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
  clip.camera.push({ t: +now().toFixed(3), rect: [x0, y0, x1 - x0, y1 - y0] });
}

/* ---------------------------------------------------------------- hands */
const mouse = { x: 760, y: 430 };
async function moveTo(x, y, seconds = 0.6) {
  const from = { ...mouse }, steps = Math.max(2, Math.round(seconds * 40));
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await sleep(seconds / steps);
  }
  mouse.x = x; mouse.y = y;
}
async function centre(locator) {
  await locator.waitFor({ state: "visible", timeout: 30000 });
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function clickAt(x, y, seconds) {
  await moveTo(x, y, seconds);
  await page.mouse.down(); await sleep(0.07); await page.mouse.up();
  await sleep(0.25);
}
async function click(locator, seconds) { const p = await centre(locator); await clickAt(p.x, p.y, seconds); }
async function type(locator, value, delay = 65) {
  await click(locator, 0.45);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(value, { delay });
  await sleep(0.2);
}
/** Smoothly scroll so the element's top sits `offset` px below the window top. */
async function scrollTo(locator, offset = 70, seconds = 0.9) {
  await locator.waitFor({ timeout: 30000 });
  await locator.evaluate((el, off) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: "smooth" }), offset);
  await sleep(seconds);
}
const toTop = async () => { await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await sleep(0.8); };
const idle = async () => { await sleep(0.5); await page.waitForFunction(() => !document.body.innerText.includes("solving…"), null, { timeout: 60000 }); await sleep(0.3); };

/* ---------------------------------------------------------------- app helpers */
const button = (name, exact = true) => page.getByRole("button", { name, exact }).first();
const card = (title) => page.locator("h2", { hasText: title }).locator("..");
async function openSection(title) {
  const head = page.locator("h2 button", { hasText: title });
  if ((await head.getAttribute("aria-expanded")) !== "true") await click(head, 0.45);
  await sleep(0.3);
  return card(title);
}
const graph = () => page.getByTestId("graph-area");
const nodes = () => page.locator(".react-flow__node");
async function clickEdge(i) {
  const p = await page.locator(".react-flow__edge-path").nth(i).evaluate((el) => {
    const q = el.getPointAtLength(el.getTotalLength() * 0.3), m = el.getScreenCTM();
    return { x: q.x * m.a + q.y * m.c + m.e, y: q.x * m.b + q.y * m.d + m.f };
  });
  await clickAt(p.x, p.y);
}
const visibleMarkers = () => page.evaluate(() => [...document.querySelectorAll("[data-testid=map-junction]")].flatMap((el, i) => {
  const r = el.getBoundingClientRect();
  return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) ? [i] : [];
}));
async function markerBounds() {
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll("[data-testid=map-junction]")].map((e) => e.getBoundingClientRect());
    const x = Math.min(...boxes.map((b) => b.left)), y = Math.min(...boxes.map((b) => b.top));
    return { x, y, width: Math.max(...boxes.map((b) => b.right)) - x, height: Math.max(...boxes.map((b) => b.bottom)) - y };
  });
}

/* ---------------------------------------------------------------- title cards */
const CARD_CSS = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{width:100vw;height:100vh;overflow:hidden;font-family:Inter,'Segoe UI',sans-serif;color:#fff;
background:radial-gradient(1200px 700px at 70% 20%,#12305a 0%,#0b1f3a 45%,#06142a 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.in{opacity:0;transform:translateY(22px);transition:opacity .8s ease,transform .8s ease}.show{opacity:1;transform:none}
.kicker{font-size:17px;font-weight:600;letter-spacing:.38em;color:#22d3ee}h1{font-size:112px;font-weight:800;letter-spacing:-.025em;line-height:1.05;margin-top:18px}
h2{font-size:34px;font-weight:500;color:#e2e8f0;margin-top:6px}.tag{font-size:25px;color:#93c5fd;margin-top:34px}
.chips{display:flex;gap:14px;margin-top:44px;align-items:center}.chip{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);border-radius:14px;padding:14px 22px;font-family:'JetBrains Mono',Consolas,monospace;font-size:21px}
.arrow{color:#22d3ee;font-size:26px}svg.net{position:fixed;inset:0;width:100%;height:100%;opacity:.17}svg.net path{stroke:#38bdf8;stroke-width:1.6;fill:none;stroke-dasharray:900;stroke-dashoffset:900;animation:draw 2.6s ease forwards}
svg.net circle{fill:#38bdf8}@keyframes draw{to{stroke-dashoffset:0}}
.grid{display:grid;grid-template-columns:repeat(4,300px);gap:20px;margin-top:46px}.tile{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:18px;padding:24px 20px;text-align:left}
.tile b{display:block;font-size:24px}.tile span{display:block;margin-top:6px;font-size:15px;color:#94a3b8;line-height:1.45}h3{font-size:46px;font-weight:800;margin-top:14px}</style>`;
const NET_BG = `<svg class="net" viewBox="0 0 1536 864" preserveAspectRatio="none">
<path d="M80 700 L300 540 L520 660 L760 560"/><path style="animation-delay:.4s" d="M300 540 L260 260 L520 150 L820 210"/><path style="animation-delay:.8s" d="M760 560 L1040 690 L1290 560 L1460 640"/>
<path style="animation-delay:1.1s" d="M820 210 L1090 130 L1300 280 L1290 560"/><path style="animation-delay:1.4s" d="M60 190 L260 260"/><path style="animation-delay:1.6s" d="M1300 280 L1480 170"/>
${[[300, 540], [520, 660], [760, 560], [260, 260], [520, 150], [820, 210], [1040, 690], [1290, 560], [1090, 130], [1300, 280]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7"/>`).join("")}</svg>`;
const showCard = async (inner) => {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${CARD_CSS}</head><body>${inner}</body></html>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.getElementById("fm-cursor")?.remove());
  await page.addStyleTag({ content: "#fm-cursor{display:none!important}" });
};
const reveal = (selector, stagger = 0) => page.evaluate(([sel, ms]) => document.querySelectorAll(sel).forEach((el, i) => setTimeout(() => el.classList.add("show"), i * ms)), [selector, stagger * 1000]);

/* ---------------------------------------------------------------- scenes */
const scenes = {
  async title() {
    await showCard(`${NET_BG}<div class="kicker in a">LINEAR ALGEBRA · GRAPH THEORY</div><h1 class="in a">FLOWMATRIX</h1>
      <h2 class="in b">Intelligent Traffic Flow Network Analyzer</h2><div class="tag in c">Transforming Real-World Road Networks into Mathematical Solutions.</div>
      <div class="chips"><div class="chip in d">incoming − outgoing = D</div><div class="arrow in d">→</div><div class="chip in d">AX = B</div><div class="arrow in d">→</div><div class="chip in d">unknown flows</div></div>`);
    await record("title", null, async () => {
      await beat("title1", async () => { await sleep(0.2); await reveal(".a", 0.25); await sleep(1.2); await reveal(".b"); await sleep(0.9); await reveal(".c"); });
      await beat("title2", async () => { await sleep(0.8); await reveal(".d", 0.5); });
      await sleep(0.5);
    });
  },

  async dashboard() {
    await page.goto(APP);
    await page.getByTestId("network-row").first().waitFor();
    await sleep(1.5);
    await record("dashboard", "Dashboard", async () => {
      const stats = page.getByTestId("stat-Total Networks").locator("xpath=ancestor::div[contains(@class,'grid')][1]");
      await beat("dash1", async () => {
        await sleep(0.8); await focus(stats, 40);
        for (const label of ["Total Networks", "Total Junctions", "Solved Networks"]) { const p = await centre(page.getByTestId(`stat-${label}`)); await moveTo(p.x + 30, p.y + 8, 0.7); await sleep(0.35); }
      });
      await beat("dash2", async () => { await focus(page.locator("section[aria-labelledby=saved]"), 20); await moveTo(520, 330, 0.8); await sleep(1); await moveTo(1090, 400, 1.2); });
      await beat("dash3", async () => {
        wide(); await click(button("Create New Network"), 0.8);
        await focus(page.getByRole("dialog"), 60);
        await moveTo((await centre(page.getByRole("button", { name: /Automatic Map-Based/ }))).x, (await centre(page.getByRole("button", { name: /Automatic Map-Based/ }))).y, 0.8);
        await sleep(0.8);
        const m = await centre(page.getByRole("button", { name: /Manual Network Creation/ })); await moveTo(m.x, m.y, 0.7);
      });
    });
  },

  async map() {
    await record("map", "Automatic map-based creation", async () => {
      await click(page.getByRole("button", { name: /Automatic Map-Based/ }), 0.6);
      await page.waitForSelector("img.leaflet-tile-loaded", { timeout: 60000 });
      const panel = page.getByText("Options").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
      const choose = async (field, query) => {
        await type(page.locator(`#${field}`), query);
        await page.waitForSelector(`#${field}-list li`, { timeout: 40000 });
        await sleep(0.9);
        const options = await page.locator(`#${field}-list li`).allInnerTexts();
        const i = Math.max(0, options.findIndex((o) => o.toLowerCase().startsWith(query.split(" ")[0].toLowerCase())));
        await click(page.locator(`#${field}-list li button`).nth(i), 0.6);
      };
      await beat("map1", async () => { await focus({ x: 255, y: 100, width: 640, height: 420 }, 0); await choose("pickup", "Gujarat College"); });
      await beat("map2", async () => {
        await choose("destination", "Mithakhali Six Roads");
        wide(); await sleep(1.0);
        await click(page.getByText("Options"), 0.6);
        await focus(panel, 10);
        await type(page.locator("#trip"), "100", 160);
      });
      let asked = 0;
      await beat("map3", async () => {
        const generate = page.getByRole("button", { name: "Generate road network" });
        await generate.scrollIntoViewIfNeeded();
        await click(generate, 0.7);
        asked = now();
        await sleep(1.6);
        await page.waitForURL(/\/network\/new/, { timeout: 240000 });
        await page.getByTestId("map-junction").first().waitFor({ timeout: 60000 });
        await idle();
        const arrived = now();
        if (arrived - asked > 5) clip.cuts.push([+(asked + 3).toFixed(3), +(arrived - 1).toFixed(3)]); // trim a long wait
        wide();
      });
      await scrollTo(graph(), 60);
      await sleep(1.2);
      await beat("map4", async () => {
        await moveTo(1000, 640, 0.6);
        await focus(await markerBounds(), 70);
        const list = await visibleMarkers();
        for (const i of list.slice(0, 4)) { const p = await centre(page.getByTestId("map-junction").nth(i)); await moveTo(p.x + 14, p.y + 4, 0.9); await sleep(0.35); }
      });
      await beat("map5", async () => { wide(); await toTop(); const notes = page.getByTestId("map-notes"); if (await notes.count()) await focus(notes, 36); await sleep(0.6); });
      await beat("map6", async () => {
        wide(); await scrollTo(graph(), 60);
        let list = await visibleMarkers();
        await click(page.getByTestId("map-junction").nth(list[0]), 0.6);
        await type(page.locator("#jn"), "Start", 90);
        await sleep(0.6);
        console.log("check: junction renamed on map =", (await page.locator("[data-testid=map-junction]", { hasText: "Star" }).count()) === 1);
        const roadsBefore = await page.locator(".fm-arrow").count();
        await page.getByTestId("properties").locator("button", { hasText: "→" }).first().waitFor();
        await click(page.getByTestId("properties").locator("button", { hasText: "→" }).first(), 0.5);
        await click(button("Delete road"), 0.6);
        await sleep(0.5);
        const afterDelete = await page.locator(".fm-arrow").count();
        console.log("check: road deleted on map =", afterDelete === roadsBefore - 1);
        await click(button("Connect roads"), 0.5);
        list = await visibleMarkers();
        for (let k = list.length - 1; k > 1; k--) {  // connect two junctions that are not yet joined this way
          const before = await page.locator(".fm-arrow").count();
          await click(page.getByTestId("map-junction").nth(list[k]), 0.45);
          await click(page.getByTestId("map-junction").nth(list[k - 2]), 0.45);
          await sleep(0.4);
          if ((await page.locator(".fm-arrow").count()) > before) break;
        }
        console.log("check: road added on map =", (await page.locator(".fm-arrow").count()) === afterDelete + 1);
        await click(button("Select"), 0.4);
      });
      await beat("map7", async () => {
        await toTop();
        await click(button("Save"), 0.6);
        await page.waitForURL(/\/network\/\d+/, { timeout: 30000 });
        await sleep(0.8);
        await focus(page.getByTestId("status").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]"), 12);
      });
    });
  },

  async manual() {
    await toTop();
    await record("manual", "Manual network creation", async () => {
      await click(button("New network"), 0.6);
      await click(page.getByRole("button", { name: /Manual Network Creation/ }), 0.7);
      await page.waitForSelector(".react-flow__pane");
      await sleep(0.8);
      await scrollTo(graph(), 105, 0.8);
      const pane = await page.locator(".react-flow__pane").boundingBox();
      const spot = (fx, fy) => [pane.x + pane.width * fx, pane.y + pane.height * fy];
      await beat("man1", async () => {
        await focus(graph(), 50);
        for (const [fx, fy] of [[0.17, 0.46], [0.5, 0.18], [0.83, 0.46], [0.5, 0.76]]) { await clickAt(...spot(fx, fy), 0.7); await sleep(0.2); }
      });
      await beat("man2", async () => {
        await click(button("Connect roads"), 0.5);
        for (const [a, b] of [[0, 1], [1, 2], [0, 3], [3, 2], [1, 3]]) { await click(nodes().nth(a), 0.35); await click(nodes().nth(b), 0.35); }
      });
      await beat("man3", async () => {
        await click(button("Select"), 0.4);
        const p = await centre(nodes().first());
        await moveTo(p.x, p.y, 0.5); await page.mouse.down();
        await moveTo(p.x - 20, p.y - 80, 0.9); await moveTo(p.x, p.y - 10, 0.9);
        await page.mouse.up();
      });
      await beat("man4", async () => {
        wide();
        for (const [i, name, demand] of [[0, "A", "-100"], [1, "B", null], [2, "C", "100"], [3, "D", null]]) {
          await click(nodes().nth(i), 0.4);
          await type(page.locator("#jn"), name, 50);
          if (demand) await type(page.locator("#jd"), demand, 110);
        }
      });
      await beat("man5", async () => {
        await clickEdge(0);
        await focus(page.getByTestId("properties"), 40);
        await type(page.locator("#rl"), "Station Road", 45);
        await click(page.getByTestId("known-toggle"), 0.4);
        await type(page.locator("#rf"), "60", 160);
        await idle();
        await focus(graph(), 20);
      });
      await beat("man6", async () => {
        wide();
        await click(button("Add junction"), 0.5);
        await clickAt(...spot(0.87, 0.84), 0.6);
        await click(button("Connect roads"), 0.4);
        await click(nodes().nth(3), 0.35); await click(nodes().nth(4), 0.35);
        await sleep(0.8);
        await click(button("Select"), 0.35);
        await click(nodes().nth(4), 0.45);
        await sleep(0.5);
        await click(page.getByRole("button", { name: /Delete junction/ }), 0.6);
        await idle();
      });
    });
  },

  async maths() {
    await record("maths", "Mathematical analysis", async () => {
      await beat("math1", async () => {
        await scrollTo(card("Traffic conservation equations"), 55, 1.1);
        const s = card("Traffic conservation equations");
        await focus(s, 14);
        await sleep(1.4);
        await click(page.locator("details", { hasText: "x1 + x3 = 100" }).locator("summary"), 0.7);
        await focus(s, 14);
      });
      await beat("math2", async () => {
        wide();
        await scrollTo(card("Coefficient matrix"), 55, 0.8);
        const s = await openSection("Coefficient matrix");
        await scrollTo(s, 55, 0.5);
        const b = await s.boundingBox();
        await focus({ x: b.x, y: b.y, width: Math.min(b.width, 640), height: b.height }, 14);
      });
      await beat("math3", async () => {
        wide();
        const s = card("Augmented matrix");
        await scrollTo(s, 55, 0.8);
        const b = await s.boundingBox();
        await focus({ x: b.x, y: b.y, width: Math.min(b.width, 600), height: b.height }, 14);
      });
      await beat("math4", async () => {
        wide();
        await scrollTo(card("Gaussian elimination"), 55, 0.7);
        const s = await openSection("Gaussian elimination");
        await scrollTo(s, 55, 0.6);
        const b = await s.boundingBox();
        await focus({ x: b.x, y: b.y, width: 720, height: 405 }, 0);
        const next = s.getByRole("button", { name: "Next step" }).first();
        for (let i = 0; i < 6; i++) { await click(next, i ? 0.15 : 0.6); await sleep(0.55); }
      });
      await beat("math5", async () => {
        const s = card("Gaussian elimination");
        wide();
        await scrollTo(page.getByText("Gauss-Jordan phase (continues from REF to RREF)"), 90, 0.7);
        const heading = await page.getByText("Gauss-Jordan phase (continues from REF to RREF)").boundingBox();
        await focus({ x: heading.x - 20, y: heading.y - 20, width: 720, height: 405 }, 0);
        await click(s.getByRole("button", { name: "Next step" }).nth(1), 0.5);
        await sleep(1.0);
        wide();
        await scrollTo(card("REF and RREF"), 60, 0.6);
        const e = await openSection("REF and RREF");
        await scrollTo(e, 60, 0.5);
        await focus(e, 14);
      });
      await beat("math6", async () => {
        wide();
        await scrollTo(card("Matrix rank"), 60, 0.7);
        await openSection("Matrix rank");
        await openSection("Pivot and free variables");
        await scrollTo(card("Matrix rank"), 60, 0.6);
        const a = await card("Matrix rank").boundingBox(), b = await card("Pivot and free variables").boundingBox();
        await focus({ x: a.x, y: a.y, width: 760, height: b.y + b.height - a.y }, 14);
      });
    });
  },

  async solution() {
    await record("solution", "Solution and null space", async () => {
      await beat("sol1", async () => {
        const s = card("General solution");
        await scrollTo(card("Solution classification"), 55, 1.0);
        const a = await card("Solution classification").boundingBox(), b = await s.boundingBox();
        await focus({ x: a.x, y: a.y, width: a.width, height: b.y + b.height - a.y }, 10);
        await sleep(2.2);
        await focus({ x: b.x, y: b.y, width: 900, height: b.height }, 12);
      });
      const example = card("Example solution");
      await beat("sol2", async () => {
        wide();
        await scrollTo(example, 55, 0.8);
        await type(page.locator("input[id^='p-']").first(), "10", 200);
        await idle();
        await scrollTo(card("Final traffic network"), 55, 0.9);
        await focus(card("Final traffic network"), 10);
      });
      await beat("sol3", async () => {
        wide();
        await scrollTo(example, 55, 0.8);
        await type(page.locator("input[id^='p-']").first(), "500", 150);
        await idle();
        const b = await example.boundingBox();
        await focus({ x: b.x, y: b.y, width: 820, height: 300 }, 10);
        await sleep(2.4);
      });
      await type(page.locator("input[id^='p-']").first(), "10", 120);
      await idle();
      await beat("sol4", async () => {
        wide();
        await scrollTo(card("Null space basis"), 55, 0.6);
        const s = await openSection("Null space basis");
        await scrollTo(s, 55, 0.8);
        const vector = page.getByTestId("null-vector").first();
        await sleep(0.8);
        await focus(vector, 18);
        const p = await centre(vector); await moveTo(p.x + 150, p.y + 60, 1.2);
      });
      await sleep(0.8);
    });
  },

  async database() {
    await toTop();
    await record("database", "Database and network management", async () => {
      const header = () => page.getByTestId("status").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
      const solved = (text) => page.waitForFunction((t) => document.querySelector("[data-testid=status]")?.textContent === t, text, { timeout: 30000 });
      await beat("db1", async () => {
        await type(page.locator("#network-name"), "Campus Junction Study", 45);
        await click(button("Save"), 0.6);
        await page.waitForURL(/\/network\/\d+/);
        await click(button("Run analysis"), 0.6);
        await solved("Solved");
        await toTop();
        await focus(header(), 12);
        await sleep(2.2);
      });
      await beat("db2", async () => {
        wide(); await page.reload(); await page.waitForSelector(".react-flow__node"); await idle();
        await sleep(0.6); await focus([header(), graph()], 8);
      });
      await beat("db3", async () => {
        wide(); await click(page.getByRole("link", { name: "Dashboard" }), 0.7);
        await page.getByTestId("network-row").first().waitFor(); await sleep(0.7);
        await focus(page.getByTestId("stat-Total Networks").locator("xpath=ancestor::div[contains(@class,'grid')][1]"), 40);
      });
      const row = (name) => page.getByTestId("network-row").filter({ hasText: name });
      await beat("db4", async () => {
        wide();
        await click(row("Campus Junction Study").getByRole("button", { name: "Edit" }), 0.8);
        await page.waitForSelector(".react-flow__node"); await idle();
        await scrollTo(graph(), 105, 0.6);
        await clickEdge(0);
        await type(page.locator("#rf"), "50", 160);
        await toTop();
        await click(button("Save"), 0.6);
        await solved("Solution outdated");
        await focus(header(), 12);
      });
      await beat("db5", async () => {
        wide(); await click(page.getByRole("link", { name: "Dashboard" }), 0.6);
        await page.getByTestId("network-row").first().waitFor(); await sleep(0.5);
        await click(row("Gujarat College").getByRole("button", { name: /Delete/ }), 0.9);
        await sleep(1.0);
        await focus(page.getByTestId("stat-Total Networks").locator("xpath=ancestor::div[contains(@class,'grid')][1]"), 40);
        await sleep(2.2);
        console.log("check: after delete, total networks =", await page.getByTestId("stat-Total Networks").innerText());
      });
    });
  },

  async tech() {
    const tiles = [["React + TypeScript", "User interface"], ["Tailwind CSS", "Styling"], ["React Flow", "Manual graph editor"], ["Leaflet", "Interactive map"],
      ["Python + FastAPI", "REST API and solver"], ["PostgreSQL", "Networks and solutions"], ["OpenStreetMap", "Real road data"], ["NumPy · SciPy · SymPy", "Feasibility and verification"]];
    await showCard(`<div class="kicker in a">UNDER THE HOOD</div><h3 class="in a">Technology stack</h3>
      <div class="grid">${tiles.map(([b, s]) => `<div class="tile in t"><b>${b}</b><span>${s}</span></div>`).join("")}</div>
      <div class="tag in c">Row reduction written from scratch, in exact fractions</div>`);
    await record("tech", null, async () => {
      await beat("tech1", async () => { await reveal(".a", 0.15); await sleep(0.7); await reveal(".t", 0.55); });
      await beat("tech2", async () => { await reveal(".c"); });
    });
  },

  async outro() {
    const uses = [["Traffic management", "Estimate flows on roads without sensors"], ["Water distribution", "Balance flow through pipe junctions"],
      ["Computer networks", "Packets in equal packets out at each node"], ["Electrical networks", "Kirchhoff's current law at every node"]];
    await showCard(`${NET_BG}<div id="uses"><div class="kicker in a">THE SAME CONSERVATION PRINCIPLE</div><h3 class="in a">Real-world applications</h3>
      <div class="grid">${uses.map(([b, s]) => `<div class="tile in u"><b>${b}</b><span>${s}</span></div>`).join("")}</div></div>
      <div id="final" style="display:none"><h1 class="in f">FLOWMATRIX</h1><div class="tag in f" style="font-size:32px">Where Mathematics Meets Real-World Networks.</div></div>`);
    await record("outro", null, async () => {
      await beat("end1", async () => { await reveal(".a", 0.15); await sleep(0.8); await reveal(".u", 1.1); });
      await page.evaluate(() => { document.getElementById("uses").style.display = "none"; document.getElementById("final").style.display = "block"; });
      await beat("end2", async () => { await sleep(0.1); await reveal(".f", 0.9); });
      await sleep(2.2);
    });
  },
};

const wanted = process.argv[3] ? process.argv[3].split(",") : Object.keys(scenes);
try {
  for (const name of wanted) await scenes[name]();
} catch (e) {
  console.log("STOPPED:", e.message.split("\n").slice(0, 8).join("\n"));
  await page.screenshot({ path: path.join(work, "failure.png") });
  process.exitCode = 1;
}
if (problems.length) console.log("page errors:", problems.slice(0, 5));
await browser.close();
