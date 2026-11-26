import { ArrowRight, ChevronLeft, ChevronRight, Home, Maximize, Minimize, StickyNote } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Matrix } from "@/components/Matrix";
import { NetworkDiagram, type EdgeStyle } from "@/components/NetworkDiagram";
import { api } from "@/lib/api";
import { toNumber } from "@/lib/graph";
import type { Analysis, NetworkDraft } from "@/lib/types";

interface Demo { net: NetworkDraft; a: Analysis }
type Demos = (Demo | null)[];

const W = 1280, H = 720;

const Title = ({ children, kicker }: { children: ReactNode; kicker: string }) => (
  <div className="mb-6"><div className="mb-1 text-sm font-semibold uppercase tracking-widest text-cyan-400">{kicker}</div>
    <h2 className="text-4xl font-bold text-white">{children}</h2><div className="mt-3 h-1 w-20 rounded bg-cyan-400" /></div>
);
const Bullets = ({ items, size = "text-2xl" }: { items: ReactNode[]; size?: string }) => (
  <ul className={`space-y-3 ${size} text-slate-200`}>{items.map((t, i) => <li key={i} className="flex gap-3"><span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-cyan-400" /><span>{t}</span></li>)}</ul>
);
const Box = ({ children, tone = "bg-navy-800", className = "" }: { children: ReactNode; tone?: string; className?: string }) => (
  <div className={`rounded-xl border border-white/10 px-4 py-3 text-center text-lg text-white ${tone} ${className}`}>{children}</div>
);
const Eq = ({ children }: { children: ReactNode }) => <div className="rounded-lg bg-black/25 px-4 py-2 font-mono text-xl text-cyan-100">{children}</div>;
const Arrow = () => <ArrowRight className="shrink-0 text-cyan-400" size={26} />;
const Loading = () => <div className="text-xl text-slate-300">Loading demonstration data from the backend…</div>;
const Shot = ({ file, alt }: { file: string; alt: string }) => (
  <img src={`/screenshots/${file}.png`} alt={alt} className="max-h-[440px] w-full rounded-xl border border-white/10 bg-white object-contain" />
);
const ShotSlide = ({ kicker, title, file, points }: { kicker: string; title: string; file: string; points: string[] }) => (
  <><Title kicker={kicker}>{title}</Title><div className="grid grid-cols-[1.6fr_1fr] gap-8"><Shot file={file} alt={title} /><Bullets size="text-xl" items={points} /></div></>
);

interface SlideDef { title: string; notes: string; render: (d: Demos) => ReactNode }

const SLIDES: SlideDef[] = [
  { title: "Title", notes: "One sentence: FlowMatrix turns a real or drawn road network into linear equations and works out the unmeasured traffic.",
    render: () => (<div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-6 rounded-full bg-cyan-400/20 px-5 py-1.5 text-sm font-semibold tracking-widest text-cyan-300">LINEAR ALGEBRA · GRAPH THEORY · DBMS</div>
      <h1 className="text-7xl font-extrabold text-white">FlowMatrix</h1>
      <p className="mt-4 text-3xl text-slate-200">Traffic Flow Network Analyzer</p>
      <p className="mt-8 max-w-3xl text-xl text-slate-400">Estimating unknown road traffic with conservation equations, row reduction and the null space</p></div>) },
  { title: "Introduction", notes: "Only some roads have sensors; conservation links the rest.",
    render: () => (<><Title kicker="Introduction">Why traffic is a linear-algebra problem</Title>
      <Bullets items={["Sensors exist only on some roads", "Vehicles are neither created nor destroyed at a junction", "Every junction gives one linear equation", "Solving the system estimates the missing flows"]} /></>) },
  { title: "Problem statement", notes: "State the inputs and the questions precisely.",
    render: () => (<><Title kicker="Problem">Problem statement</Title>
      <Bullets items={["Given: junctions, one-way road segments, external demand D, some measured flows", "Find: every flow assignment on the unmeasured roads", "Unique, infinitely many, or impossible?", "Physically possible: are all flows ≥ 0?"]} />
      <div className="mt-8"><Eq>incoming flow − outgoing flow = D   ⇒   AX = B</Eq></div></>) },
  { title: "Objectives", notes: "These map to what you will demonstrate.",
    render: () => (<><Title kicker="Objectives">Objectives</Title><div className="grid grid-cols-2 gap-x-10">
      <Bullets size="text-xl" items={["Networks from real maps or drawn by hand", "One shared graph model and solver", "Automatic equations and matrices", "Every row operation shown"]} />
      <Bullets size="text-xl" items={["Rank, free variables, null space", "Nonnegative (physical) feasibility", "Results drawn back on the roads", "Database storage and PDF reports"]} /></div></>) },
  { title: "Proposed solution", notes: "Contrast with manual working.",
    render: () => (<><Title kicker="Solution">Existing way and proposed solution</Title><div className="grid grid-cols-2 gap-8">
      <div className="rounded-2xl bg-red-500/10 p-6"><h3 className="mb-3 text-2xl font-bold text-red-300">By hand</h3><Bullets size="text-xl" items={["Sketch the junctions", "Write equations manually", "Eliminate on paper or spreadsheet", "Sketch is detached from real roads"]} /></div>
      <div className="rounded-2xl bg-emerald-500/10 p-6"><h3 className="mb-3 text-2xl font-bold text-emerald-300">FlowMatrix</h3><Bullets size="text-xl" items={["Real roads from OpenStreetMap, or draw them", "Equations generated from the graph", "Exact, verified row reduction", "Flows written back onto the network"]} /></div></div></>) },
  { title: "System architecture", notes: "Both creation methods meet at the common graph model before the solver.",
    render: () => (<><Title kicker="Architecture">System architecture</Title>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-3"><Box className="w-52">Map creation</Box><Box className="w-52">Manual canvas</Box></div><Arrow />
        <Box className="w-44 py-6"><b>Common graph</b><br /><span className="text-sm text-slate-300">junctions · roads</span></Box><Arrow />
        <Box className="w-40 py-6"><b>FastAPI</b><br /><span className="text-sm text-slate-300">validation</span></Box><Arrow />
        <div className="space-y-2"><Box className="w-56" tone="bg-brand-700">Linear-algebra engine</Box><Box className="w-56" tone="bg-brand-700">Graph / BFS</Box><Box className="w-56" tone="bg-brand-700">PDF report</Box></div><Arrow />
        <Box className="w-40 py-6"><b>PostgreSQL</b></Box></div>
      <p className="mt-10 text-xl text-slate-300">The map service (Photon, OSRM, Overpass) feeds map creation through the backend.</p></>) },
  { title: "Technology stack", notes: "Why React Flow and Leaflet; why SymPy only verifies.",
    render: () => (<><Title kicker="Stack">Technology stack</Title><div className="grid grid-cols-3 gap-6">
      {[["Frontend", "React · TypeScript · Vite · Tailwind CSS · React Flow · Leaflet · Recharts"], ["Backend", "Python · FastAPI · SQLAlchemy · SciPy · SymPy · ReportLab · HTTPX"], ["Data & services", "PostgreSQL · OpenStreetMap · Photon · OSRM · Overpass · Pytest · Vitest · Playwright"]].map(([h, t]) => (
        <Box key={h} className="py-8 text-left"><div className="mb-2 text-2xl font-bold text-cyan-300">{h}</div><div className="text-lg">{t}</div></Box>))}</div></>) },
  { title: "Automatic map-based creation", notes: "Search two places, generate, and point out real street names and one-way arrows.",
    render: () => <ShotSlide kicker="Method 1" title="Automatic map-based creation" file="map-network" points={["Search pickup and destination", "Real roads in a corridor around the route", "Intersections become vertices", "One-way rules preserved", "Edit, add flows, save"]} /> },
  { title: "Manual network creation", notes: "Click to create junctions; connect two junctions; edit in the side panel.",
    render: () => <ShotSlide kicker="Method 2" title="Manual network creation" file="manual-editor" points={["Click to create junctions", "Connect junctions with one-way roads", "Edges follow their junctions", "Set demands and measured flows", "Same solver as map mode"]} /> },
  { title: "OpenStreetMap integration", notes: "Mention usage policies: attribution, identified requests, caching, no Nominatim autocomplete.",
    render: () => (<><Title kicker="Map data">OpenStreetMap integration</Title>
      <div className="mb-8 flex items-center gap-3">{["Photon search", "OSRM route", "Overpass roads", "Junctions & edges", "Workspace"].map((s, i, a) => <div key={s} className="flex items-center gap-3"><Box>{s}</Box>{i < a.length - 1 && <Arrow />}</div>)}</div>
      <Bullets size="text-xl" items={["Respects usage policies: attribution, identified and spaced requests, caching", "Public Nominatim forbids autocomplete, so Photon is used", "Errors and no-route cases are explained, with retry or manual creation"]} /></>) },
  { title: "Graph representation", notes: "Adjacency lists, BFS, directed versus weak connectivity.",
    render: (d) => (<><Title kicker="Graph theory">Graph representation and BFS</Title><div className="grid grid-cols-2 gap-8">
      <Bullets size="text-xl" items={["Junction = vertex, road = directed edge", "Two-way street = two edges", "Adjacency lists: O(V + E)", "BFS: reachability and connectivity", "Disconnected parts are reported"]} />
      <div className="rounded-xl bg-black/25 p-4 font-mono text-lg text-cyan-100">{d[2] ? <>
        {Object.entries(d[2].a.graph.adjacency_out).map(([k, v]) => <div key={k}>{k} → [{v.join(", ")}]</div>)}
        <div className="mt-3 text-slate-300">BFS from {d[2].a.graph.start}: {d[2].a.graph.bfs_directed?.order.join(" → ")}</div></> : <Loading />}</div></div></>) },
  { title: "Equation generation", notes: "Read one junction aloud and show where the measured flow moves.",
    render: (d) => (<><Title kicker="Mathematics">One equation per junction</Title>{d[1] ? <div className="grid grid-cols-[1.1fr_1fr] gap-8">
      <div className="rounded-2xl bg-white p-3"><NetworkDiagram net={d[1].net} height={360} /></div>
      <div className="space-y-3"><div className="text-lg text-slate-300">incoming − outgoing = D (Network 2)</div>{d[1].a.equations.map((e) => <Eq key={e.junction_key}>{e.junction_name}: {e.text}</Eq>)}
        <p className="text-lg text-slate-300">The measured flow on C→A is moved to the right-hand side.</p></div></div> : <Loading />}</>) },
  { title: "Matrix formation", notes: "Variable order is fixed everywhere.",
    render: (d) => (<><Title kicker="Mathematics">Matrix formation: AX = B</Title>{d[1] ? <div className="flex items-center justify-center gap-6 text-white">
      <div><div className="mb-1 text-cyan-300">A</div><Matrix light data={d[1].a.matrix.A} cols={d[1].a.matrix.variables} /></div>
      <div><div className="mb-1 text-cyan-300">X</div><Matrix light data={d[1].a.matrix.variables.map((v) => [v])} /></div><span className="text-3xl">=</span>
      <div><div className="mb-1 text-cyan-300">B</div><Matrix light data={d[1].a.matrix.B.map((v) => [v])} /></div>
      <div className="ml-10"><div className="mb-1 text-cyan-300">[A | B]</div><Matrix light augment data={d[1].a.matrix.augmented} /></div></div> : <Loading />}
      <p className="mt-10 text-xl text-slate-300">Rows are junctions, columns are unknown roads; entries are −1, 0 or +1.</p></>) },
  { title: "Gaussian elimination and RREF", notes: "Walk through the operations in order.",
    render: (d) => (<><Title kicker="Row reduction">Gaussian elimination and RREF</Title>{d[1] ? <div className="grid grid-cols-3 gap-6">
      <div className="space-y-2">{d[1].a.reduction.steps.filter((s) => s.kind !== "pivot").map((s) => <Eq key={s.index}>{s.notation}</Eq>)}</div>
      <div className="text-white"><div className="mb-1 text-cyan-300">REF</div><Matrix light augment data={d[1].a.reduction.ref} /></div>
      <div className="text-white"><div className="mb-1 text-cyan-300">RREF</div><Matrix light augment data={d[1].a.reduction.rref} /><p className="mt-4 text-lg">rank = {d[1].a.analysis.rank}</p></div></div> : <Loading />}</>) },
  { title: "Free variables and null space", notes: "Add the green and subtract the red: every junction still balances.",
    render: (d) => {
      const x = d[1], b = x?.a.analysis.null_basis[0];
      if (!x || !b) return <><Title kicker="Null space">Free variables and null space</Title><Loading /></>;
      const styles: Record<string, EdgeStyle> = {};
      x.net.roads.forEach((r) => (styles[r.key] = { color: "#cbd5e1", label: "" }));
      x.a.circulations[0].roads.forEach((c) => (styles[c.road_key] = { color: toNumber(c.coefficient) > 0 ? "#059669" : "#dc2626", label: `${c.variable} ${toNumber(c.coefficient) > 0 ? "+" : ""}${c.coefficient}`, bold: true }));
      return (<><Title kicker="Null space">Free variables and the null space</Title><div className="grid grid-cols-[1.1fr_1fr] gap-8">
        <div className="rounded-2xl bg-white p-3"><NetworkDiagram net={x.net} styles={styles} height={360} showDemand={false} /></div>
        <div className="space-y-3">{x.a.analysis.general_solution.map((g) => <Eq key={g.variable}>{g.text}</Eq>)}
          <Bullets size="text-xl" items={[`Null vector v = (${b.vector.join(", ")}), A·v = 0`, "Circulating traffic keeps every junction balanced", "Feasible only while all flows stay ≥ 0"]} /></div></div></>);
    } },
  { title: "Live traffic flow visualization", notes: "Change a parameter live and show the labels update.",
    render: () => <ShotSlide kicker="Visualization" title="Live traffic flows on the network" file="final-network" points={["Measured, calculated, parameter-dependent and free flows are coloured differently", "Negative flows are flagged, never hidden", "Changing a parameter updates every label"]} /> },
  { title: "Database design", notes: "A road is known exactly when it has an observed_flows row.",
    render: () => (<><Title kicker="DBMS">Database design</Title><div className="grid grid-cols-3 gap-4">
      {[["users", "id, username"], ["networks", "id, user_id, name, method, map_meta, timestamps"], ["junctions", "id, network_id, key, name, lat, lng, node_type, net_demand"], ["roads", "id, network_id, source_id, target_id, name, geometry, length, direction"], ["observed_flows", "id, road_id (unique), value ≥ 0, measured_at"], ["solutions", "id, network_id, classification, rank, result, stale"]].map(([t, c]) => (
        <Box key={t} className="text-left"><div className="font-mono text-lg font-bold text-cyan-300">{t}</div><div className="mt-1 text-sm text-slate-300">{c}</div></Box>))}</div>
      <p className="mt-6 text-lg text-slate-300">Cascading deletes · one transaction per save · edits mark old solutions outdated</p></>) },
  { title: "Application demonstration", notes: "Switch to the app now: Create New Network, both methods.",
    render: () => <ShotSlide kicker="Demonstration" title="One page: network and analysis" file="map-analysis" points={["Dashboard → Create New Network", "Workflow A: map → edit → flows → analyse → save", "Workflow B: draw → flows → RREF → parameters → save"]} /> },
  { title: "Testing and results", notes: "Numbers on this slide are computed live.",
    render: (d) => (<><Title kicker="Quality">Testing and results</Title>
      {d.every(Boolean) ? <table className="w-full text-left text-xl text-slate-100"><thead className="text-sm uppercase text-cyan-300"><tr><th className="py-2">Demo network</th><th>Unknowns</th><th>Rank</th><th>Nullity</th><th>Outcome</th><th>Verified</th></tr></thead><tbody>
        {d.map((x, i) => <tr key={i} className="border-t border-white/10"><td className="py-2">Network {i + 1}</td><td>{x!.a.analysis.n_unknowns}</td><td>{x!.a.analysis.rank}</td><td>{x!.a.analysis.nullity}</td><td>{x!.a.analysis.classification}</td><td>{x!.a.verification.all_passed ? "✔" : "✘"}</td></tr>)}</tbody></table> : <Loading />}
      <div className="mt-8"><Bullets size="text-xl" items={["Pytest: mathematics, map conversion, API, database upgrade", "Vitest: graph editing operations; Playwright: both workflows end to end", "Run-time checks: AX = B, Av = 0, SymPy comparison"]} /></div></>) },
  { title: "Future scope", notes: "Be honest about the limits.",
    render: () => (<><Title kicker="Next steps">Limitations and future scope</Title><div className="grid grid-cols-2 gap-8">
      <div><h3 className="mb-3 text-2xl font-bold text-amber-300">Limitations</h3><Bullets size="text-xl" items={["Static flows only", "Edge-of-map demands must be entered", "Public map services can be slow", "No user authentication"]} /></div>
      <div><h3 className="mb-3 text-2xl font-bold text-emerald-300">Future scope</h3><Bullets size="text-xl" items={["Live sensor feeds", "Least squares for noisy data", "Capacities and min-cost flow", "Turn restrictions, time of day"]} /></div></div></>) },
  { title: "Conclusion", notes: "Close by linking the subjects.",
    render: () => (<div className="flex h-full flex-col justify-center"><Title kicker="Conclusion">Conclusion</Title>
      <Bullets items={["A road network, real or drawn, becomes AX = B", "Row reduction decides existence and uniqueness", "The null space explains alternative flows as circulations", "Graph theory, a database and real map data complete the solution"]} />
      <p className="mt-10 text-3xl font-semibold text-cyan-300">Thank you. Questions?</p></div>) },
];

export default function PresentationMode() {
  const [i, setI] = useState(() => Math.min(SLIDES.length - 1, Math.max(0, Number(sessionStorage.getItem("tfna.slide") ?? 0))));
  const [scale, setScale] = useState(1);
  const [full, setFull] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const canFull = typeof document !== "undefined" && !!document.fullscreenEnabled;
  const [notes, setNotes] = useState(false);
  const [demos, setDemos] = useState<Demos>([null, null, null]);
  const root = useRef<HTMLDivElement>(null);

  // Load the demonstration networks and analyse them with the real backend.
  useEffect(() => {
    (async () => {
      try {
        const list = (await api.dashboard()).networks;
        const out: Demos = [null, null, null];
        for (let n = 1; n <= 3; n++) {
          const s = list.find((x) => x.is_demo && x.name.startsWith(`Network ${n}`));
          if (!s) continue;
          const net = await api.getNetwork(s.id);
          const { result } = await api.analyze(net, {});
          if (result) out[n - 1] = { net, a: result };
        }
        setDemos(out);
      } catch { /* the slides show a loading note */ }
    })();
  }, []);

  useEffect(() => { try { sessionStorage.setItem("tfna.slide", String(i)); } catch { /* ignore */ } }, [i]);
  useEffect(() => {
    const f = () => {
      const pt = window.innerWidth < 700 && window.innerHeight > window.innerWidth;
      setPortrait(pt);
      setScale(Math.min(window.innerWidth / W, (window.innerHeight - (notes ? 160 : 60) - (pt ? 34 : 0)) / H));
    };
    f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f);
  }, [notes]);
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f); return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  const go = useCallback((d: number) => setI((x) => Math.min(SLIDES.length - 1, Math.max(0, x + d))), []);
  const toggleFull = useCallback(() => { if (document.fullscreenElement) document.exitFullscreen(); else root.current?.requestFullscreen?.(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "Home") setI(0); else if (e.key === "End") setI(SLIDES.length - 1);
      else if (e.key.toLowerCase() === "f") toggleFull(); else if (e.key.toLowerCase() === "n") setNotes((v) => !v);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [go, toggleFull]);

  const slide = SLIDES[i];
  const content = useMemo(() => slide.render(demos), [slide, demos]);
  return (
    <div ref={root} className="flex h-dvh flex-col bg-navy-950 text-white" data-testid="presentation"
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const t = touch.current; touch.current = null; if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 50 && Math.abs(dy) < 60) go(dx < 0 ? 1 : -1);
      }}>
      {portrait && <div className="bg-cyan-400/15 px-3 py-1.5 text-center text-xs text-cyan-200">Tip: rotate your phone to landscape for a larger slide. Swipe left/right to change slides.</div>}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <div style={{ width: W, height: H, transform: `scale(${scale})`, flex: "none" }} key={i}
          className="fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 to-navy-950 p-14 shadow-2xl" role="region" aria-label={`Slide ${i + 1}: ${slide.title}`}>
          {content}
          <div className="absolute bottom-4 right-6 text-sm text-slate-500">{i + 1} / {SLIDES.length}</div>
        </div>
      </div>
      {notes && <div className="max-h-28 overflow-y-auto border-t border-white/10 bg-navy-900 px-6 py-3 text-sm text-slate-200"><b className="text-cyan-300">Presenter notes — {slide.title}: </b>{slide.notes}</div>}
      <div className="safe-bottom safe-x flex items-center gap-1 border-t border-white/10 bg-navy-900 px-2 py-2 text-sm sm:gap-2 sm:px-4">
        <Link to="/" className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/10" aria-label="Exit presentation"><Home size={16} /><span className="hidden sm:inline">Exit</span></Link>
        <button className="rounded-lg p-1.5 hover:bg-white/10 disabled:opacity-30" disabled={i === 0} onClick={() => go(-1)} aria-label="Previous slide"><ChevronLeft /></button>
        <select aria-label="Jump to slide" className="min-w-0 flex-1 rounded bg-navy-800 px-2 py-1 sm:max-w-[16rem] sm:flex-none" value={i} onChange={(e) => setI(Number(e.target.value))}>
          {SLIDES.map((s, k) => <option key={k} value={k}>{k + 1}. {s.title}</option>)}</select>
        <button className="rounded-lg p-1.5 hover:bg-white/10 disabled:opacity-30" disabled={i === SLIDES.length - 1} onClick={() => go(1)} aria-label="Next slide"><ChevronRight /></button>
        <span className="ml-2 hidden whitespace-nowrap text-slate-400 lg:inline">← → space · F fullscreen · N notes</span>
        <button className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/10" aria-label="Toggle presenter notes" onClick={() => setNotes(!notes)}><StickyNote size={16} /><span className="hidden sm:inline">Notes</span></button>
        {canFull && <button className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/10" aria-label={full ? "Exit full screen" : "Full screen"} onClick={toggleFull}>{full ? <Minimize size={16} /> : <Maximize size={16} />}<span className="hidden whitespace-nowrap sm:inline">{full ? "Exit full screen" : "Full screen"}</span></button>}
      </div>
    </div>
  );
}

export const SLIDE_COUNT = SLIDES.length;
export const SLIDE_TITLES = SLIDES.map((s) => s.title);
