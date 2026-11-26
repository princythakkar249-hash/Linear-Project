/** Pure operations on the shared graph model. Every editor (canvas or map) goes through these. */
import type { Analysis, FlowStatus, Junction, LatLng, NetworkDraft, Road, SolutionInfo } from "./types";

export function emptyNetwork(): NetworkDraft {
  return { name: "Untitled network", description: "", method: "manual", junctions: [], roads: [] };
}

export function nextKey(prefix: string, existing: string[]): string {
  const used = new Set(existing);
  let i = 1;
  while (used.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

/** Unknown roads are numbered x1, x2, ... in road order (mirrors the backend rule). */
export function variableNames(n: NetworkDraft): Record<string, string> {
  const out: Record<string, string> = {};
  let k = 0;
  for (const r of n.roads) if (r.known_flow === null || r.known_flow === "") out[r.key] = `x${++k}`;
  return out;
}

export const roadTitle = (n: NetworkDraft, r: Road) => {
  const name = (k: string) => n.junctions.find((j) => j.key === k)?.name ?? k;
  return `${r.label || "Unnamed road"} (${name(r.source)} → ${name(r.target)})`;
};

export function addJunction(n: NetworkDraft, at: { x: number; y: number; lat?: number; lng?: number }): { net: NetworkDraft; key: string } {
  const key = nextKey("J", n.junctions.map((j) => j.key));
  const names = new Set(n.junctions.map((j) => j.name));
  let i = Number(key.slice(1));
  while (names.has(`J${i}`)) i++;
  const j: Junction = { key, name: `J${i}`, x: Math.round(at.x), y: Math.round(at.y), lat: at.lat ?? null, lng: at.lng ?? null,
    node_type: "junction", net_demand: "0" };
  return { net: { ...n, junctions: [...n.junctions, j] }, key };
}

export function updateJunction(n: NetworkDraft, key: string, patch: Partial<Junction>): NetworkDraft {
  return { ...n, junctions: n.junctions.map((j) => (j.key === key ? { ...j, ...patch } : j)) };
}

/** Deleting a junction deletes every road connected to it (and therefore their measured flows). */
export function removeJunction(n: NetworkDraft, key: string): NetworkDraft {
  return { ...n, junctions: n.junctions.filter((j) => j.key !== key), roads: n.roads.filter((r) => r.source !== key && r.target !== key) };
}

export function addRoad(n: NetworkDraft, source: string, target: string, allowParallel = false): { net: NetworkDraft; key?: string; error?: string } {
  const a = n.junctions.find((j) => j.key === source), b = n.junctions.find((j) => j.key === target);
  if (!a || !b) return { net: n, error: "Both ends of a road must be existing junctions." };
  if (source === target) return { net: n, error: "A road cannot start and end at the same junction." };
  if (!allowParallel && n.roads.some((r) => r.source === source && r.target === target))
    return { net: n, error: `A road ${a.name} → ${b.name} already exists. Enable “parallel roads” to add another.` };
  const key = nextKey("r", n.roads.map((r) => r.key));
  const geometry: LatLng[] | null = a.lat != null && a.lng != null && b.lat != null && b.lng != null ? [[a.lat, a.lng], [b.lat, b.lng]] : null;
  const road: Road = { key, label: "", source, target, known_flow: null, length_m: geometry ? Math.round(distance(geometry[0], geometry[1])) : null,
    geometry, osm_way_id: null, highway: "", origin: "user" };
  return { net: { ...n, roads: [...n.roads, road] }, key };
}

export function updateRoad(n: NetworkDraft, key: string, patch: Partial<Road>): NetworkDraft {
  return { ...n, roads: n.roads.map((r) => (r.key === key ? { ...r, ...patch } : r)) };
}
export function removeRoad(n: NetworkDraft, key: string): NetworkDraft {
  return { ...n, roads: n.roads.filter((r) => r.key !== key) };
}
export function reverseRoad(n: NetworkDraft, key: string): NetworkDraft {
  return { ...n, roads: n.roads.map((r) => (r.key === key
    ? { ...r, source: r.target, target: r.source, geometry: r.geometry ? [...r.geometry].reverse() : r.geometry } : r)) };
}
/** Move a road to different start / end junctions, with the same rules as drawing a new road. */
export function setEndpoints(n: NetworkDraft, key: string, source: string, target: string, allowParallel = false): { net: NetworkDraft; error?: string } {
  const road = n.roads.find((r) => r.key === key);
  if (!road || (road.source === source && road.target === target)) return { net: n };
  const others = { ...n, roads: n.roads.filter((r) => r.key !== key) };
  const made = addRoad(others, source, target, allowParallel);
  if (made.error) return { net: n, error: made.error };
  const drawn = made.net.roads[made.net.roads.length - 1];
  // The old shape no longer joins these junctions, so it is not kept (nor presented as OpenStreetMap geometry).
  const moved: Road = { ...road, source, target, geometry: drawn.geometry, length_m: drawn.length_m, osm_way_id: null, highway: "", origin: "user" };
  return { net: updateRoad(n, key, moved) };
}

export const oppositeRoads =(n: NetworkDraft, r: Road) => n.roads.filter((o) => o.key !== r.key && o.source === r.target && o.target === r.source);

/** One-way <-> two-way. A two-way street is two directed edges, one per direction. */
export function setTwoWay(n: NetworkDraft, key: string, twoWay: boolean): NetworkDraft {
  const r = n.roads.find((x) => x.key === key);
  if (!r) return n;
  const opposite = oppositeRoads(n, r);
  if (twoWay && !opposite.length) {
    const back: Road = { ...r, key: nextKey("r", n.roads.map((x) => x.key)), source: r.target, target: r.source, known_flow: null,
      geometry: r.geometry ? [...r.geometry].reverse() : r.geometry };
    return { ...n, roads: [...n.roads, back] };
  }
  if (!twoWay) { const drop = new Set(opposite.map((o) => o.key)); return { ...n, roads: n.roads.filter((x) => !drop.has(x.key)) }; }
  return n;
}

/* ---------- geographic helpers ---------- */
export function distance(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180, R = 6371008.8;
  const h = Math.sin(((b[0] - a[0]) * rad) / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(((b[1] - a[1]) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const pathLength = (line: LatLng[]) => line.slice(1).reduce((s, p, i) => s + distance(line[i], p), 0);

function closestOnPath(line: LatLng[], p: LatLng): { index: number; point: LatLng } {
  const k = Math.cos((p[0] * Math.PI) / 180);
  let best = { d: Infinity, index: 0, point: line[0] };
  for (let i = 0; i + 1 < line.length; i++) {
    const [ay, ax] = line[i], [by, bx] = line[i + 1];
    const dx = (bx - ax) * k, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((p[1] - ax) * k * dx + (p[0] - ay) * dy) / (dx * dx + dy * dy || 1)));
    const point: LatLng = [ay + t * (by - ay), ax + t * (bx - ax)];
    const d = distance(point, p);
    if (d < best.d) best = { d, index: i, point };
  }
  return best;
}

/** Insert a junction on a map road: the road (and its opposite direction) is split at the clicked point.
 *  A measured flow stays on the first half; with D = 0 at the new junction the solver derives the second half. */
export function splitRoadAt(n: NetworkDraft, key: string, at: LatLng): { net: NetworkDraft; key?: string; error?: string } {
  const road = n.roads.find((r) => r.key === key);
  const a = n.junctions.find((j) => j.key === road?.source), b = n.junctions.find((j) => j.key === road?.target);
  if (!road || !road.geometry || road.geometry.length < 2 || !a || !b) return { net: n, error: "This road has no map geometry to split." };
  const { point } = closestOnPath(road.geometry, at);
  if (distance(point, road.geometry[0]) < 5 || distance(point, road.geometry[road.geometry.length - 1]) < 5)
    return { net: n, error: "Click further from the end of the road." };
  const total = pathLength(road.geometry) || 1;
  const frac = Math.min(1, distance(road.geometry[0], point) / total);
  const added = addJunction(n, { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac, lat: point[0], lng: point[1] });
  let net = added.net;
  const mid = added.key;
  for (const r of [road, ...oppositeRoads(n, road)]) {
    const line = r.geometry ?? [];
    const cut = closestOnPath(line, point);
    const first: LatLng[] = [...line.slice(0, cut.index + 1), point], second: LatLng[] = [point, ...line.slice(cut.index + 1)];
    const halfA: Road = { ...r, target: mid, geometry: first, length_m: Math.round(pathLength(first)) };
    const halfB: Road = { ...r, key: nextKey("r", net.roads.map((x) => x.key)), source: mid, known_flow: null, geometry: second, length_m: Math.round(pathLength(second)) };
    const i = net.roads.findIndex((x) => x.key === r.key);
    net = { ...net, roads: [...net.roads.slice(0, i), halfA, halfB, ...net.roads.slice(i + 1)] };
  }
  return { net, key: mid };
}

/* ---------- what each road shows after solving ---------- */
export type FlowKind = FlowStatus | "negative";
export const FLOW_COLORS: Record<FlowKind, string> = {
  known: "#0f766e", determined: "#1d4ed8", parametric: "#7c3aed", free: "#d97706", negative: "#dc2626", unresolved: "#64748b",
};
export const FLOW_LABELS: Record<FlowKind, string> = {
  known: "Measured", determined: "Calculated", parametric: "Depends on a free variable", free: "Free variable", negative: "Negative (not physical)", unresolved: "Unsolved",
};
export interface RoadFlow { text: string; kind: FlowKind; variable: string | null; value: string | null }

/** Which numbers to display: the user's parameters; otherwise a feasible example if t = 0 would be negative. */
export function chooseSolution(a: Analysis | null, params: Record<string, string>): { solution: SolutionInfo | null; auto: boolean } {
  if (!a?.sample_solution) return { solution: null, auto: false };
  const untouched = Object.keys(params).length === 0;
  if (untouched && !a.sample_solution.physically_feasible && a.feasible_example) return { solution: a.feasible_example, auto: true };
  return { solution: a.sample_solution, auto: false };
}

export function roadFlows(n: NetworkDraft, a: Analysis | null, solution: SolutionInfo | null): Record<string, RoadFlow> {
  const names = variableNames(n);
  const status = new Map(a?.road_status.map((s) => [s.road_key, s]));
  const out: Record<string, RoadFlow> = {};
  for (const r of n.roads) {
    const variable = names[r.key] ?? null;
    if (!variable) { out[r.key] = { text: String(r.known_flow), kind: "known", variable, value: String(r.known_flow) }; continue; }
    const s = status.get(r.key);
    const value = s && s.variable === variable && s.status !== "unresolved" ? solution?.values[variable] ?? null : null;
    if (value === null) { out[r.key] = { text: variable, kind: "unresolved", variable, value }; continue; }
    out[r.key] = { text: `${variable} = ${value}`, kind: value.startsWith("-") ? "negative" : s!.status, variable, value };
  }
  return out;
}

/** Parse "7/2", "-3.5", "12" for drawing and charts (the backend arithmetic is exact). */
export function toNumber(s: string): number {
  if (s.includes("/")) { const [a, b] = s.split("/"); return Number(a) / Number(b); }
  return Number(s);
}

/** Rebuild the matrix after the first `upto` row operations. */
export function replay(initial: string[][], steps: { changed: Record<string, string[]> }[], upto: number): string[][] {
  const m = initial.slice();
  for (let k = 0; k < upto; k++) for (const [row, values] of Object.entries(steps[k].changed)) m[Number(row)] = values;
  return m;
}

export function demandText(d: string): string {
  const v = Number(d);
  if (!v) return "";
  return v < 0 ? `${-v} enter` : `${v} leave`;
}
