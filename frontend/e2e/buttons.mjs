/** Audit of the buttons and interactions that the two workflows do not touch.  node e2e/buttons.mjs */
import { chromium } from "playwright-core";

const U = process.env.APP_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let expected = false; // set while service failures are simulated on purpose
page.on("console", (m) => m.type() === "error" && !(expected && /status of 502/.test(m.text())) && errors.push(m.text().slice(0, 160)));
page.on("dialog", (d) => d.accept());
let failed = 0;
const check = (label, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`); if (!ok) failed++; };
const api = async (path, init) => { const r = await fetch(U + path, init); return r.status === 204 ? null : r.json(); };
const wait = (ms = 600) => page.waitForTimeout(ms);
const before = (await api("/api/dashboard")).networks.map((n) => n.id);

try {
  // a network to play with
  const body = { name: "Audit network", junctions: [{ key: "J1", name: "J1", x: 80, y: 100, net_demand: "-5" }, { key: "J2", name: "J2", x: 320, y: 100, net_demand: "5" }], roads: [{ key: "r1", source: "J1", target: "J2" }] };
  const made = await api("/api/networks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const row = () => page.getByTestId("network-row").filter({ hasText: "Audit network" });

  await page.goto(U); await row().waitFor();
  await row().getByRole("button", { name: "Open" }).click(); await page.waitForSelector(".react-flow__node");
  check("dashboard Open: read-only view", page.url().endsWith(`/network/${made.id}`) && (await page.getByText("Read-only view").count()) === 1);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  check("Edit button enables editing", (await page.getByRole("button", { name: "Add junction" }).count()) === 1);
  await page.getByRole("button", { name: "Done editing" }).click();
  check("Done editing returns to read-only", (await page.getByText("Read-only view").count()) === 1);
  await page.goto(U); await row().getByRole("button", { name: "Edit" }).click(); await page.waitForSelector(".react-flow__node");
  check("dashboard Edit: opens in edit mode", (await page.getByRole("button", { name: "Done editing" }).count()) === 1);

  const labels = page.getByTestId("flow-label");
  const selectRoad = async () => { await page.getByRole("button", { name: "Select", exact: true }).click(); await page.locator(".react-flow__node").first().click(); await page.getByTestId("properties").locator("button", { hasText: "→" }).first().click(); await wait(200); };
  await selectRoad();
  await page.getByRole("button", { name: "Make two-way" }).click(); await wait();
  check("Make two-way adds the opposite road", (await labels.count()) === 2);
  await page.getByRole("button", { name: "Make one-way" }).click(); await wait();
  check("Make one-way removes it", (await labels.count()) === 1);
  await page.getByRole("button", { name: "Reverse direction" }).click(); await wait();
  check("Reverse direction swaps the ends", (await page.getByTestId("properties").innerText()).includes("J2 → J1"));
  await page.getByRole("button", { name: "Reverse direction" }).click(); await wait();
  await page.getByRole("button", { name: "Connect roads" }).click();
  await page.getByLabel("parallel roads").check();
  await page.locator(".react-flow__node").nth(0).click(); await page.locator(".react-flow__node").nth(1).click(); await wait();
  check("parallel roads option allows a second road", (await labels.count()) === 2);
  await page.keyboard.press("Delete"); await wait();
  check("Delete key removes the selected road", (await labels.count()) === 1);
  await page.getByRole("button", { name: "Save", exact: true }).click(); await wait(1200);
  check("Save stores edits", (await api(`/api/networks/${made.id}`)).roads.length === 1);
  await page.getByRole("button", { name: "Delete", exact: true }).click(); await wait(1200);
  check("workspace Delete removes the network", new URL(page.url()).pathname === "/" && (await api("/api/dashboard")).networks.every((n) => n.id !== made.id));

  // dashboard Delete
  const second = await api("/api/networks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  await page.goto(U); await row().waitFor();
  const totalBefore = Number(await page.getByTestId("stat-Total Networks").innerText());
  await row().getByRole("button", { name: /Delete/ }).click(); await wait(1200);
  check("dashboard Delete updates list and statistics", Number(await page.getByTestId("stat-Total Networks").innerText()) === totalBefore - 1 && (await row().count()) === 0);
  void second;

  // demo: saving makes a copy
  const demo = (await api("/api/dashboard")).networks.find((n) => n.is_demo);
  await page.goto(`${U}/network/${demo.id}?edit=1`); await page.waitForSelector(".react-flow__node"); await wait();
  await page.getByRole("button", { name: "Save", exact: true }).click(); await wait(1500);
  const copy = (await api("/api/dashboard")).networks.find((n) => n.name === `${demo.name} (copy)`);
  check("saving a demo creates a copy and leaves the original", Boolean(copy) && (await api(`/api/networks/${demo.id}`)).name === demo.name);

  // sidebar button, dialog and Escape
  await page.getByRole("button", { name: "New network" }).click();
  check("sidebar New network opens the two choices", (await page.getByRole("dialog").getByRole("button", { name: /Network/ }).count()) >= 2);
  await page.keyboard.press("Escape"); await wait(200);
  check("Escape closes the dialog", (await page.getByRole("dialog").count()) === 0);

  // section navigation
  await page.getByRole("navigation", { name: "Analysis sections" }).getByRole("button", { name: /Row operation history/ }).click(); await wait(900);
  check("section chip opens and scrolls to its section", (await page.locator("h2 button", { hasText: "Row operation history" }).getAttribute("aria-expanded")) === "true");

  // choosing places on the map, dragging a marker, Change
  await page.goto(`${U}/create/map`); await page.waitForSelector(".leaflet-container"); await wait(1500);
  const map = await page.locator(".leaflet-container").boundingBox();
  await page.getByRole("button", { name: "or pick on the map" }).first().click();
  await page.mouse.click(map.x + map.width * 0.35, map.y + map.height * 0.5);
  await page.getByTestId("pickup-selected").waitFor({ timeout: 20000 }); await wait(2500);
  check("pick pickup by clicking the map", true, (await page.getByTestId("pickup-selected").innerText()).split("\n")[0]);
  const pin = page.locator(".fm-pin").first();
  const p = await pin.boundingBox();
  const textBefore = await page.getByTestId("pickup-selected").innerText();
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2); await page.mouse.down(); await page.mouse.move(p.x + 160, p.y - 90, { steps: 12 }); await page.mouse.up(); await wait(3500);
  check("dragging the marker changes the location", (await page.getByTestId("pickup-selected").innerText()) !== textBefore);
  await page.getByRole("button", { name: "Change pickup location" }).click();
  check("Change clears the selection", (await page.getByTestId("pickup-selected").count()) === 0 && (await page.getByRole("button", { name: "Generate road network" }).isDisabled()));

  // editable start / end junction, duplicate-safe reverse
  const post = (b) => api("/api/networks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
  const tri = await post({ name: "Audit ends", junctions: [1, 2, 3].map((i) => ({ key: `J${i}`, name: `J${i}`, x: i * 160, y: i === 2 ? 40 : 200 })),
    roads: [{ key: "r1", source: "J1", target: "J2" }, { key: "r2", source: "J2", target: "J3" }] });
  await page.goto(`${U}/network/${tri.id}?edit=1`); await page.waitForSelector(".react-flow__node"); await wait();
  await selectRoad();
  await page.getByLabel("Ending junction").selectOption("J3"); await wait();
  check("Ending junction can be changed", (await page.getByTestId("properties").innerText()).includes("J1 → J3"));
  await page.getByLabel("Starting junction").selectOption("J3"); await wait();
  check("a change that would make a self-loop is refused", (await page.getByText(/same junction/).count()) === 1 && (await page.getByTestId("properties").innerText()).includes("J1 → J3"));
  await page.getByRole("button", { name: "Make two-way" }).click(); await wait(300);
  check("Reverse is disabled on a two-way street", await page.getByRole("button", { name: "Reverse direction" }).isDisabled());
  await page.getByTestId("known-toggle").check(); await page.fill("#rf", "4"); await wait();
  await page.getByTestId("known-toggle").uncheck(); await wait();
  check("a measured flow can be marked unknown again", (await page.getByTestId("properties").innerText()).includes("Unknown flow"));

  // editing a map network: add a road, split one by clicking it, change its ends
  const at = { J1: [23.03, 72.56], J2: [23.03, 72.566], J3: [23.034, 72.563] };
  const road = (key, a, b) => ({ key, source: a, target: b, geometry: [at[a], at[b]], origin: "osm", osm_way_id: "1" });
  const geo = await post({ name: "Audit map", method: "map", junctions: Object.entries(at).map(([k, [lat, lng]]) => ({ key: k, name: k, lat, lng })),
    roads: [road("r1", "J1", "J2"), road("r2", "J2", "J3")] });
  await page.goto(`${U}/network/${geo.id}?edit=1`); await page.getByTestId("map-junction").first().waitFor(); await wait(1500);
  const arrows = page.locator(".fm-arrow");
  const marker = (name) => page.locator("[data-testid=map-junction]", { hasText: name });
  await page.getByRole("button", { name: "Connect roads" }).click();
  await marker("J3").click(); await marker("J1").click(); await wait();
  check("map: add a road by connecting two junctions", (await arrows.count()) === 3);
  await page.getByRole("button", { name: "Add junction" }).click();
  await page.getByTestId("graph-area").scrollIntoViewIfNeeded(); await wait(300);
  const point = await page.evaluate(() => {
    for (const el of document.querySelectorAll("path.fm-road-hit")) {
      const m = el.getScreenCTM();
      for (const f of [0.5, 0.35, 0.65, 0.25]) {
        const q = el.getPointAtLength(el.getTotalLength() * f);
        const p = { x: q.x * m.a + q.y * m.c + m.e, y: q.x * m.b + q.y * m.d + m.f };
        if (document.elementFromPoint(p.x, p.y) === el) return p;
      }
    }
    return null;
  });
  if (point) await page.mouse.click(point.x, point.y);
  await wait();
  check("map: clicking a road splits it with a new junction", Boolean(point) && (await page.getByTestId("map-junction").count()) === 4 && (await arrows.count()) === 4);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await marker("J3").click();
  await page.getByTestId("properties").locator("button", { hasText: "→" }).first().click(); await wait(300);
  const wasOsm = (await page.getByTestId("properties").innerText()).includes("OpenStreetMap");
  const end = await page.getByLabel("Ending junction").inputValue(), start = await page.getByLabel("Starting junction").inputValue();
  const free = ["J1", "J2", "J3", "J4"].filter((k) => k !== end && k !== start);
  let moved = "";
  for (const other of free) {  // the first choice may duplicate an existing road, which is refused by design
    await page.getByLabel("Ending junction").selectOption(other); await wait();
    moved = await page.getByTestId("properties").innerText();
    if (moved.includes("added by hand")) break;
  }
  check("map: moved road is redrawn and no longer presented as OpenStreetMap", wasOsm && moved.includes("added by hand"));
  await page.getByRole("button", { name: "Save", exact: true }).click(); await wait(1500);
  const kept = await api(`/api/networks/${geo.id}`);
  const pos = Object.fromEntries(kept.junctions.map((j) => [j.key, `${j.lat},${j.lng}`]));
  check("map: every saved road geometry meets its junctions", kept.roads.length === 4 && kept.roads.every((r) => r.geometry[0].join() === pos[r.source] && r.geometry.at(-1).join() === pos[r.target]));

  // analysis controls
  const advanced = (await api("/api/dashboard")).networks.find((n) => n.name.startsWith("Network 3"));
  await page.goto(`${U}/network/${advanced.id}`); await page.getByTestId("equation").first().waitFor(); await wait();
  const value = () => page.locator("input[id^='p-']").first().inputValue();
  await page.getByRole("button", { name: "Set all to 0" }).click(); await wait();
  check("Set all to 0", (await value()) === "0");
  await page.getByRole("button", { name: "Use a feasible example" }).click(); await wait();
  check("Use a feasible example", (await page.getByText("Physically feasible").count()) >= 1);
  await page.selectOption("#bfs", "J3"); await wait(1200);
  check("BFS start selector re-runs the search", (await page.locator("#sec-validation").innerText()).includes("J3 → J5"));

  // documentation and viva
  await page.goto(`${U}/docs`);
  await page.getByRole("tab", { name: "Viva preparation" }).click();
  const all = await page.locator("details").count();
  await page.getByRole("button", { name: "Advanced" }).click();
  check("viva level filter", (await page.locator("details").count()) < all);
  await page.setViewportSize({ width: 600, height: 800 });
  await page.getByRole("tab", { name: "Documentation" }).click();
  await page.locator("main select").selectOption("doc-20"); await wait(1500);
  check("documentation jump menu scrolls", (await page.evaluate(() => window.scrollY)) > 500);
  await page.setViewportSize({ width: 1440, height: 900 });

  // map creation errors: message, Retry, Cancel, manual fallback (service responses simulated)
  await page.route("**/api/geocode?**", (r) => {
    const alpha = r.request().url().includes("Alpha");
    return r.fulfill({ json: [{ label: alpha ? "Alpha" : "Beta", detail: "", lat: alpha ? 23.03 : 23.04, lng: 72.56 }] });
  });
  let calls = 0, hold = false;
  await page.route("**/api/map/network", async (r) => { calls++; if (!hold) await r.fulfill({ status: 502, json: { detail: "Road data could not be downloaded. Retry in a minute." } }); });
  await page.goto(`${U}/create/map`); await page.evaluate(() => localStorage.removeItem("flowmatrix.draft"));
  for (const [field, text] of [["pickup", "Alpha"], ["destination", "Beta"]]) { await page.fill(`#${field}`, text); await page.locator(`#${field}-list li button`).first().click(); }
  expected = true;
  await page.getByRole("button", { name: "Generate road network" }).click(); await wait();
  check("service failure is explained", (await page.getByText(/could not be downloaded/).count()) === 1);
  await page.getByRole("button", { name: "Retry" }).click(); await wait();
  check("Retry sends the request again", calls === 2);
  hold = true;
  await page.getByRole("button", { name: "Generate road network" }).click(); await wait(1200);
  check("loading indicator while generating", (await page.getByText(/downloading road data/).count()) === 1);
  await page.getByRole("button", { name: "Cancel" }).click(); await wait();
  check("Cancel stops waiting", await page.getByRole("button", { name: "Generate road network" }).isEnabled());
  hold = false;
  await page.getByRole("button", { name: "Generate road network" }).click(); await wait();
  await page.getByRole("link", { name: "Create the network manually" }).click(); await page.waitForSelector(".react-flow__pane");
  await wait();
  check("manual fallback link opens an empty canvas", (await page.locator(".react-flow__node").count()) === 0);
  await page.unrouteAll({ behavior: "ignoreErrors" }); expected = false;

  // unsaved draft banner
  const pane = await page.locator(".react-flow__pane").boundingBox();
  await page.mouse.click(pane.x + 120, pane.y + 120); await wait();
  await page.goto(U); await wait(800);
  await page.getByRole("button", { name: "Continue editing" }).click(); await page.waitForSelector(".react-flow__node");
  check("unsaved draft can be continued from the dashboard", (await page.locator(".react-flow__node").count()) === 1);
  await page.evaluate(() => localStorage.removeItem("flowmatrix.draft"));

  // settings
  await page.goto(`${U}/settings`);
  await page.getByRole("button", { name: /dark theme/ }).click();
  check("dark theme toggles", await page.evaluate(() => document.documentElement.classList.contains("dark")));
  await page.getByRole("button", { name: /light theme/ }).click();
  check("backend status shown", (await page.getByText("connected").count()) === 1);
} catch (e) {
  failed++;
  console.log("FAIL  script stopped:", e.message.split("\n").slice(0, 5).join("\n"));
}
for (const n of (await api("/api/dashboard")).networks) if (!before.includes(n.id)) await api(`/api/networks/${n.id}`, { method: "DELETE" });
check("no browser errors", errors.length === 0, errors.slice(0, 3).join(" || "));
console.log(failed ? `\n${failed} check(s) failed` : "\nALL CHECKS PASSED");
await browser.close();
process.exit(failed ? 1 : 0);
