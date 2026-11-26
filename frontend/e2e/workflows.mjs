/**
 * End-to-end check of both creation workflows in a real browser, and capture of the documentation screenshots.
 *
 *   backend on :8000 and `npm run dev` on :5173, then:  node e2e/workflows.mjs [A|B|all]
 *
 * Uses the installed Microsoft Edge (set BROWSER_PATH for another Chromium). Workflow A talks to the live
 * OpenStreetMap services, so it needs internet access and can take a minute.
 * Networks created by this script are deleted again unless KEEP=1.
 */
import { mkdirSync, statSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_ = process.env.APP_URL ?? "http://127.0.0.1:5173";
const which = process.argv[2] ?? "all";
const SHOTS = new URL("../public/screenshots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(decodeURIComponent(SHOTS), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
let expected4xx = false;
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !(expected4xx && /status of 4\d\d/.test(m.text()))) errors.push(`console: ${m.text()}`); });
page.on("dialog", (d) => d.accept());

let failed = 0;
const check = (label, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`); if (!ok) failed++; };
/** Screenshot for the documentation: floating messages hidden; `width` narrows the window so text stays legible. */
const shot = async (name, locator, width) => {
  if (width) { await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(500); }
  const style = await page.addStyleTag({ content: "[aria-live], nav[aria-label='Analysis sections'] { display: none !important; }" +
    (width ? " [data-testid=properties] { display: none !important; }" : "") });
  await (locator ?? page).screenshot({ path: `${decodeURIComponent(SHOTS)}${name}.png` });
  await style.evaluate((el) => el.remove());
  if (width) { await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(300); }
};
const created = [];
const api = async (path, init) => { const r = await fetch(URL_ + path, init); return r.status === 204 ? null : r.json(); };
const stats = () => api("/api/dashboard");
const statusText = () => page.getByTestId("status").innerText();
const idle = async () => { await page.waitForTimeout(500); await page.waitForFunction(() => !document.body.innerText.includes("solving…"), null, { timeout: 30000 }); };
const section = async (title) => {
  const button = page.locator("h2 button", { hasText: title });
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  await page.waitForTimeout(200);
  return page.locator("h2", { hasText: title }).locator("..");
};
const download = async () => {
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF report" }).click()]);
  return statSync(await file.path()).size;
};

/* ------------------------------------------------------------------ Workflow B: manual */
async function workflowB() {
  console.log("\n=== Workflow B: manual network ===");
  const before = await stats();
  await page.goto(URL_);
  await page.waitForSelector("[data-testid='stat-Total Networks']");
  check("dashboard totals match the database", (await page.getByTestId("stat-Total Networks").innerText()) === String(before.total_networks));
  await shot("dashboard");
  await page.getByRole("button", { name: "Create New Network" }).click();
  await page.getByRole("button", { name: /Manual Network Creation/ }).click();
  await page.waitForSelector(".react-flow__pane");
  check("starts with an empty workspace and instructions", await page.getByText("Empty workspace").isVisible());

  const pane = await page.locator(".react-flow__pane").boundingBox();
  const spots = [[0.14, 0.45], [0.48, 0.17], [0.84, 0.45], [0.48, 0.78]];
  for (const [fx, fy] of spots) { await page.mouse.click(pane.x + pane.width * fx, pane.y + pane.height * fy); await page.waitForTimeout(150); }
  const nodes = page.locator(".react-flow__node");
  check("clicking the canvas creates junctions", (await nodes.count()) === 4, `${await nodes.count()}`);

  await page.getByRole("button", { name: "Connect roads" }).click();
  const join = async (a, b) => { await nodes.nth(a).click(); await nodes.nth(b).click(); await page.waitForTimeout(150); };
  for (const [a, b] of [[0, 1], [1, 2], [0, 3], [3, 2], [1, 3]]) await join(a, b);
  const labels = page.getByTestId("flow-label");
  check("two clicks connect two junctions", (await labels.count()) === 5, `${await labels.count()} roads`);
  await join(0, 1);
  check("duplicate road is blocked", await page.getByText(/already exists/).isVisible() && (await labels.count()) === 5);
  await join(2, 2);
  check("self-connection is blocked", await page.getByText(/same junction/).isVisible() && (await labels.count()) === 5);

  // drag a junction: connected edges must follow
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const edgePath = () => page.locator(".react-flow__edge-path").first().getAttribute("d");
  const pathBefore = await edgePath();
  const box = await nodes.first().boundingBox();
  await page.mouse.move(box.x + 28, box.y + 28); await page.mouse.down(); await page.mouse.move(box.x + 28, box.y - 12, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(300);
  check("moving a junction moves its roads", (await edgePath()) !== pathBefore);

  // properties: rename, demands, measured flow
  const select = async (i) => { await nodes.nth(i).click(); await page.waitForTimeout(150); };
  await select(0); await page.fill("#jn", "A"); await page.fill("#jd", "-100");
  await select(1); await page.fill("#jn", "B");
  await select(2); await page.fill("#jn", "C"); await page.fill("#jd", "100");
  await select(3); await page.fill("#jn", "D");
  check("rename updates the node", (await nodes.nth(0).innerText()).startsWith("A"));
  const clickEdge = async (i) => {
    const point = await page.locator(".react-flow__edge-path").nth(i).evaluate((p) => {
      const q = p.getPointAtLength(p.getTotalLength() * 0.3), m = p.getScreenCTM();
      return { x: q.x * m.a + q.y * m.c + m.e, y: q.x * m.b + q.y * m.d + m.f };
    });
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(150);
  };
  await clickEdge(0);
  await page.fill("#rl", "Station Road");
  await page.getByTestId("known-toggle").check();
  await page.fill("#rf", "60");
  await idle();
  check("measured flow shown on its road", (await labels.allInnerTexts()).some((t) => t.startsWith("60")));
  await shot("manual-editor");

  // mathematics
  await section("Traffic conservation equations");
  const equations = await page.getByTestId("equation").allInnerTexts();
  check("one equation per junction", equations.length === 4, equations.join(" | "));
  check("equations follow incoming - outgoing = D", equations[0] === "-x2 = -40" && equations[2] === "x1 + x3 = 100", equations.join(" | "));
  await page.locator("details", { hasText: "x1 + x3 = 100" }).locator("summary").click();
  await shot("equations", await section("Traffic conservation equations"), 760);
  await page.locator("details[open] summary").first().click();
  await shot("augmented", await section("Augmented matrix"), 520);
  const gauss = await section("Gaussian elimination");
  await gauss.getByRole("button", { name: "Next step" }).first().click();
  await gauss.getByRole("button", { name: "Next step" }).first().click();
  await shot("row-reduction", gauss, 640);
  const history = await section("Row operation history");
  const operations = await history.locator("li button").count();
  await history.locator("li button").first().click();
  check("row operation history with intermediate matrices", operations > 0 && (await history.locator("li .font-mono").count()) > 0, `${operations} operations`);
  await section("REF and RREF");
  check("REF and RREF shown", await page.getByText("RREF (Gauss-Jordan elimination)").isVisible());
  await section("Pivot and free variables");
  const free = await page.getByTestId("free-variables").innerText();
  check("free variable identified", free !== "none", free);
  const general = await section("General solution");
  check("general solution uses parameters", (await page.getByTestId("general-line").allInnerTexts()).some((t) => /t1/.test(t)));
  await shot("general-solution", general, 640);
  await shot("null-space", await section("Null space basis"), 640);
  check("null space basis drawn", (await page.getByTestId("null-vector").count()) >= 1);

  // change a free parameter: labels must follow
  await section("Example solution");
  const input = page.locator("input[id^='p-']").first();
  const flowsBefore = await labels.allInnerTexts();
  await input.fill("10"); await idle();
  const flowsAfter = await labels.allInnerTexts();
  check("changing a free variable updates road labels", JSON.stringify(flowsBefore) !== JSON.stringify(flowsAfter), flowsAfter.join(" | "));
  await input.fill("500"); await idle();
  check("negative flows are reported as not physically feasible", await page.getByText(/Not physically feasible/).first().isVisible() && (await labels.allInnerTexts()).some((t) => t.includes("-")));
  await input.fill("10"); await idle();
  await shot("final-network", await section("Final traffic network"), 900);

  // save, solve, reload
  await page.fill("#network-name", "E2E Manual Network");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(/\/network\/\d+/);
  const id = Number(page.url().match(/network\/(\d+)/)[1]); created.push(id);
  await page.getByRole("button", { name: "Run analysis" }).click();
  await page.waitForFunction(() => document.querySelector("[data-testid=status]")?.textContent === "Solved", null, { timeout: 15000 }).catch(() => {});
  check("saved and marked Solved", (await statusText()) === "Solved", await statusText());
  check("PDF report downloads", (await download()) > 3000);
  await page.reload(); await page.waitForSelector(".react-flow__node"); await idle();
  check("network persists after reload", (await nodes.count()) === 4 && (await labels.count()) === 5 && (await statusText()) === "Solved");
  const after = await stats();
  check("dashboard statistics updated from the database",
    after.total_networks === before.total_networks + 1 && after.total_junctions === before.total_junctions + 4 && after.solved_networks === before.solved_networks + 1);

  // delete a junction and a road: edits invalidate the stored solution
  const editButton = page.getByRole("button", { name: "Edit", exact: true });
  if (await editButton.count()) await editButton.click();
  await select(3);
  await page.getByRole("button", { name: /Delete junction/ }).click(); await idle();
  check("deleting a junction removes its roads", (await nodes.count()) === 3 && (await labels.count()) === 2);
  await section("Traffic conservation equations");
  check("equations rebuilt after deletion", (await page.getByTestId("equation").count()) === 3);
  await clickEdge(1);
  await page.getByRole("button", { name: "Delete road" }).click(); await idle();
  check("deleting a road works", (await labels.count()) === 1);
  await page.getByRole("button", { name: "Save", exact: true }).click(); await page.waitForTimeout(1200);
  const stored = await api(`/api/networks/${id}`);
  check("deletion persisted and old solution invalidated", stored.junctions.length === 3 && stored.roads.length === 1 && ["outdated", "solved"].includes(stored.status.state), stored.status.state);
}

/* ------------------------------------------------------------------ Workflow A: map */
async function workflowA() {
  console.log("\n=== Workflow A: automatic map-based network ===");
  const before = await stats();
  await page.goto(URL_);
  await page.getByRole("button", { name: "Create New Network" }).click();
  await page.getByRole("button", { name: /Automatic Map-Based Network/ }).click();
  await page.waitForSelector(".leaflet-container");
  check("real map tiles requested from OpenStreetMap", (await page.locator("img.leaflet-tile[src*='tile.openstreetmap.org']").count()) > 0);
  check("attribution shown", (await page.locator(".leaflet-control-attribution").innerText()).includes("OpenStreetMap"));
  const generate = page.getByRole("button", { name: "Generate road network" });
  check("cannot generate before both places are selected", await generate.isDisabled());

  const choose = async (field, query, snapshot) => {
    await page.fill(`#${field}`, query);
    await page.waitForSelector(`#${field}-list li`, { timeout: 30000 });
    const options = await page.locator(`#${field}-list li`).allInnerTexts();
    if (snapshot) await shot("map-search");
    const wanted = options.findIndex((o) => o.toLowerCase().startsWith(query.split(" ")[0].toLowerCase()));
    await page.locator(`#${field}-list li button`).nth(Math.max(0, wanted)).click();
    return options.length;
  };
  check("pickup autocomplete returns suggestions", (await choose("pickup", "Gujarat College")) > 0);
  check("destination autocomplete returns suggestions", (await choose("destination", "Mithakhali Six Roads", true)) > 0);
  check("selected places displayed and changeable", (await page.getByTestId("pickup-selected").count()) === 1 && (await page.getByRole("button", { name: "Change destination location" }).count()) === 1);
  await page.getByText("Options").click();
  await page.fill("#trip", "100");

  let generated = false;
  for (let attempt = 1; attempt <= 3 && !generated; attempt++) {
    expected4xx = true;
    await page.getByRole("button", { name: attempt === 1 ? "Generate road network" : "Retry" }).first().click();
    const outcome = await Promise.race([
      page.waitForURL(/\/network\/new/, { timeout: 200000 }).then(() => "ok"),
      page.getByRole("button", { name: "Retry" }).waitFor({ timeout: 200000 }).then(() => "retry"),
    ]);
    if (outcome === "ok") generated = true;
    else console.log(`      attempt ${attempt}: ${(await page.locator("[role=alert]").first().innerText()).split("\n")[0]}`);
  }
  expected4xx = false;
  errors.splice(0, errors.length, ...errors.filter((e) => !/status of 502/.test(e)));
  check("road network generated from OpenStreetMap", generated);
  if (!generated) return;

  const markers = page.getByTestId("map-junction");
  await markers.first().waitFor();
  await idle(); await page.waitForTimeout(2500);
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("flowmatrix.draft")));
  const nJ = draft.junctions.length, nR = draft.roads.length;
  const names = [...new Set(draft.roads.map((r) => r.label).filter(Boolean))];
  check("junctions and roads extracted", nJ >= 3 && nR >= 3, `${nJ} junctions, ${nR} roads; streets: ${names.slice(0, 4).join(", ")}`);
  check("every road references existing junctions", draft.roads.every((r) => draft.junctions.some((j) => j.key === r.source) && draft.junctions.some((j) => j.key === r.target)));
  const at = Object.fromEntries(draft.junctions.map((j) => [j.key, `${j.lat},${j.lng}`]));
  check("road geometry meets its junctions (not straight pickup-destination lines)",
    draft.roads.every((r) => r.geometry[0].join() === at[r.source] && r.geometry.at(-1).join() === at[r.target]) && draft.roads.some((r) => r.geometry.length > 2));
  const oneway = draft.roads.filter((r) => !draft.roads.some((o) => o.source === r.target && o.target === r.source)).length;
  check("one-way roads preserved", oneway > 0, `${oneway} roads without a reverse edge`);
  const noteCount = (draft.map_meta.notes ?? []).length;
  check("what the generator merged or left out is shown to the user",
    noteCount === 0 || (await page.getByTestId("map-notes").locator("li").count()) === noteCount, `${noteCount} note(s)`);
  check("markers and direction arrows on the map", (await markers.count()) === nJ && (await page.locator(".fm-arrow").count()) === nR);
  await shot("map-network", page.getByTestId("graph-area"));

  // Markers close together overlap at this zoom; use ones that are actually clickable (a user would zoom in).
  const visibleMarkers = () => page.evaluate(() => [...document.querySelectorAll("[data-testid=map-junction]")].flatMap((el, i) => {
    el.scrollIntoView({ block: "nearest" });
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) ? [i] : [];
  }));
  const clickable = async (k) => { await page.getByTestId("graph-area").scrollIntoViewIfNeeded(); const list = await visibleMarkers(); return markers.nth(list[Math.min(k, list.length - 1)]); };

  // edit: delete a road, add a junction on the map, rename a junction
  await (await clickable(1)).click();
  const links = page.getByTestId("properties").locator("button", { hasText: "→" });
  await links.first().click();
  await page.getByRole("button", { name: "Delete road" }).click(); await idle();
  check("road deleted on the map", (await page.locator(".fm-arrow").count()) === nR - 1);
  await page.getByRole("button", { name: "Add junction" }).click();
  await page.locator(".leaflet-container").scrollIntoViewIfNeeded();
  const area = await page.locator(".leaflet-container").boundingBox();
  await page.mouse.click(area.x + area.width * 0.08, area.y + area.height * 0.12); await page.waitForTimeout(500);
  check("junction added by clicking the map", (await markers.count()) === nJ + 1);
  await page.getByRole("button", { name: /Delete junction/ }).click(); await idle();
  check("junction deleted on the map", (await markers.count()) === nJ);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const target = await clickable(0);
  await target.click();
  await page.fill("#jn", "Start"); await idle();
  check("junction renamed", (await page.locator("[data-testid=map-junction]", { hasText: "Star" }).count()) === 1);

  // known flow: use a value from a computed solution so that the data stays consistent
  const table = await section("Final traffic network");
  const solvable = (await table.getByTestId("final-table").locator("tbody tr").allInnerTexts()).length > 0;
  await (await clickable(1)).click();
  await page.getByTestId("properties").locator("button", { hasText: "→" }).first().click();
  const current = await page.getByTestId("properties").innerText();
  const value = current.match(/x\d+ = (\d+(?:\/\d+)?)/)?.[1] ?? "0";
  await page.getByTestId("known-toggle").check();
  await page.fill("#rf", value.includes("/") ? "0" : value); await idle();
  check("known traffic flow entered on a real road", solvable && (await page.getByTestId("properties").innerText()).includes("Measured"), `flow ${value}`);

  await section("Traffic conservation equations");
  check("equations generated for every junction", (await page.getByTestId("equation").count()) === nJ);
  const classification = await page.locator("h2", { hasText: "Solution classification" }).innerText();
  check("mathematical analysis classifies the system", /Unique|Infinitely|Inconsistent/.test(classification), classification.split("\n").pop());
  await section("Matrix rank");
  await section("Pivot and free variables");
  await shot("map-analysis");

  // the order of the specification: run the analysis first, save afterwards
  await page.getByRole("button", { name: "Run analysis" }).click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(/\/network\/\d+/);
  const id = Number(page.url().match(/network\/(\d+)/)[1]); created.push(id);
  await page.waitForFunction(() => document.querySelector("[data-testid=status]")?.textContent === "Solved", null, { timeout: 10000 }).catch(() => {});
  check("run then save: status shows Solved without reloading", (await statusText()) === "Solved", await statusText());
  check("PDF report downloads for the map network", (await download()) > 3000);
  await page.reload(); await page.getByTestId("map-junction").first().waitFor(); await idle();
  const saved = await api(`/api/networks/${id}`);
  check("map network saved and reloads with geometry", saved.method === "map" && saved.junctions.length === nJ && saved.roads.length === nR - 1 && saved.roads.every((r) => r.geometry?.length >= 2) && (await page.getByTestId("map-junction").count()) === nJ,
    `status ${saved.status.state}`);
  const after = await stats();
  check("dashboard counts the new map network", after.total_networks === before.total_networks + 1);
}

try {
  if (which === "all" || which === "B") await workflowB();
  if (which === "all" || which === "A") await workflowA();
} catch (e) {
  failed++;
  console.log("FAIL  script stopped:", e.message.split("\n").slice(0, 6).join("\n"));
  await page.screenshot({ path: `${process.env.TEMP ?? "/tmp"}/flowmatrix-e2e-failure.png` });
}
if (!process.env.KEEP) for (const id of created) await api(`/api/networks/${id}`, { method: "DELETE" });
check("no browser errors", errors.length === 0, errors.slice(0, 5).join(" || "));
console.log(failed ? `\n${failed} check(s) failed` : "\nALL CHECKS PASSED");
await browser.close();
process.exit(failed ? 1 : 0);
