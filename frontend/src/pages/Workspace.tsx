/** One page per network: header actions, the map or canvas, and the complete analysis underneath. */
import { Download, Link2, MousePointer2, Pencil, PlusCircle, Save, Sigma, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnalysisSections, Legend } from "@/components/Analysis";
import ManualCanvas, { type Mode, type Selection } from "@/components/ManualCanvas";
import { NetworkMap } from "@/components/MapView";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { Alert, Badge, Button, Card, Input } from "@/components/ui/ui";
import { api } from "@/lib/api";
import { addJunction, addRoad, chooseSolution, removeJunction, removeRoad, roadFlows, splitRoadAt, updateJunction } from "@/lib/graph";
import { storeDraft, useWorkspace } from "@/lib/useWorkspace";
import { cn, download } from "@/lib/utils";
import type { State } from "@/lib/types";

export const STATE_BADGE: Record<State, { label: string; tone: "neutral" | "green" | "amber" | "red" }> = {
  not_solved: { label: "Not solved", tone: "neutral" }, solved: { label: "Solved", tone: "green" },
  outdated: { label: "Solution outdated", tone: "amber" }, inconsistent: { label: "Inconsistent", tone: "red" },
};
const HINT: Record<Mode, string> = {
  select: "Click a junction or road to inspect it.",
  add: "Click on the empty area to create a junction.",
  connect: "Click the start junction, then the end junction.",
};

export default function Workspace() {
  const { id: param } = useParams();
  const id = param && param !== "new" ? Number(param) : null;
  const ws = useWorkspace(id);
  const { net, setNet, analysis, validation } = ws;
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(id === null || search.get("edit") === "1");
  const [mode, setMode] = useState<Mode>("select");
  const [selected, setSelected] = useState<Selection>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [parallel, setParallel] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState<"save" | "run" | "report" | "delete" | null>(null);
  const [ran, setRan] = useState(false);
  const analysisRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);

  useEffect(() => { setEditing(id === null || search.get("edit") === "1"); }, [id, search]);
  // An empty manual workspace starts in "add" mode.
  useEffect(() => {
    if (!net || initialised.current) return;
    initialised.current = true;
    if (net.method === "manual" && net.junctions.length === 0) setMode("add");
  }, [net]);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), 7000); return () => clearTimeout(t); }, [message]);
  useEffect(() => { setConnectFrom(null); }, [mode, editing]);

  const { solution, auto } = useMemo(() => chooseSolution(analysis, ws.params), [analysis, ws.params]);
  const flows = useMemo(() => (net ? roadFlows(net, analysis, solution) : {}), [net, analysis, solution]);

  // Delete / Backspace removes the selection (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editing || !net || !selected || !["Delete", "Backspace"].includes(e.key)) return;
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      e.preventDefault();
      setNet(selected.kind === "junction" ? removeJunction(net, selected.key) : removeRoad(net, selected.key));
      setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, net, selected, setNet]);

  // Do not lose unsaved edits to a stored network by accident.
  const unsavedEdits = Boolean(net?.id && ws.dirty);
  useEffect(() => {
    if (!unsavedEdits) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const click = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest?.("a[href^='/']");
      if (link && !confirm("Discard your unsaved changes to this network?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [unsavedEdits]);

  if (ws.loadError) return <Alert tone="error">{ws.loadError} <Link className="underline" to="/">Back to the dashboard</Link></Alert>;
  if (!net) return <p className="text-slate-500">Loading network…</p>;

  const connect = (source: string, target: string) => {
    const out = addRoad(net, source, target, parallel);
    if (out.error) { setMessage({ tone: "error", text: out.error }); return; }
    setNet(out.net); setSelected({ kind: "road", key: out.key! });
  };
  const junctionClick = (key: string) => {
    if (editing && mode === "connect") {
      if (!connectFrom) { setConnectFrom(key); return; }
      connect(connectFrom, key); setConnectFrom(null);
      return;
    }
    setSelected({ kind: "junction", key });
  };

  const record = async (networkId: number) => { await api.storeSolution(networkId, ws.params); };
  const doSave = async () => {
    setBusy("save");
    try {
      const saved = await ws.save();
      let note = `Saved “${saved.name}”.`;
      // "Run analysis" before saving counts: record the solution as soon as the network has an id.
      if (ran && analysis) { await record(saved.id!); await ws.reload(saved.id); note += " Solution recorded."; }
      if (saved.id !== id) navigate(`/network/${saved.id}${editing ? "?edit=1" : ""}`, { replace: true, state: { keep: true } });
      setMessage({ tone: "ok", text: note });
    } catch (e: any) { setMessage({ tone: "error", text: `Not saved: ${e.message}` }); }
    setBusy(null);
  };
  const doRun = async () => {
    setRan(true);
    analysisRef.current?.scrollIntoView({ behavior: "smooth" });
    if (validation && !validation.ok) { setMessage({ tone: "error", text: "Fix the validation errors first." }); return; }
    if (!analysis) { setMessage({ tone: "info", text: "The analysis is still running…" }); return; }
    if (!net.id || ws.dirty) { setMessage({ tone: "info", text: "Analysis shown below. Save the network to record its solution status." }); return; }
    setBusy("run");
    try { await record(net.id); await ws.reload(); setMessage({ tone: "ok", text: "Analysis complete and solution recorded." }); }
    catch (e: any) { setMessage({ tone: "error", text: e.message }); }
    setBusy(null);
  };
  const doReport = async () => {
    setBusy("report");
    try { download(await api.report(net, solution?.parameters ?? ws.params), `${net.name.replace(/[^\w]+/g, "_")}_report.pdf`); }
    catch (e: any) { setMessage({ tone: "error", text: e.message }); }
    setBusy(null);
  };
  const doDelete = async () => {
    if (!confirm(net.id ? `Delete “${net.name}” and its stored solutions?` : "Discard this unsaved network?")) return;
    setBusy("delete");
    try { if (net.id) await api.deleteNetwork(net.id); else storeDraft(null); navigate("/"); }
    catch (e: any) { setMessage({ tone: "error", text: e.message }); setBusy(null); }
  };

  const status = !net.id ? { label: "Not saved yet", tone: "amber" as const } : ws.dirty ? { label: "Unsaved changes", tone: "amber" as const } : STATE_BADGE[net.status?.state ?? "not_solved"];
  const tool = (m: Mode, label: string, Icon: typeof MousePointer2) => (
    <Button size="sm" variant={mode === m ? "default" : "outline"} aria-pressed={mode === m} onClick={() => setMode(m)}><Icon size={14} />{label}</Button>
  );

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1 basis-72">
          {editing
            ? <Input aria-label="Network name" id="network-name" className="max-w-lg text-lg font-bold" value={net.name} onChange={(e) => setNet({ ...net, name: e.target.value })} />
            : <h1 className="text-xl font-bold">{net.name}</h1>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="blue">{net.method === "map" ? "Automatic · OpenStreetMap" : "Manual"}</Badge>
            <span data-testid="status"><Badge tone={status.tone}>{status.label}</Badge></span>
            {net.is_demo && <Badge tone="cyan">Demo (saving makes a copy)</Badge>}
            <span className="text-slate-500">{net.junctions.length} junctions · {net.roads.length} roads</span>
            {ws.loading && <span className="text-slate-400">solving…</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={doSave} disabled={busy !== null || net.junctions.length === 0}><Save size={16} />{busy === "save" ? "Saving…" : "Save"}</Button>
          <Button variant="outline" aria-pressed={editing} onClick={() => { setEditing(!editing); setMode("select"); }}><Pencil size={16} />{editing ? "Done editing" : "Edit"}</Button>
          <Button variant="outline" onClick={doRun} disabled={busy !== null || net.junctions.length === 0}><Sigma size={16} />Run analysis</Button>
          <Button variant="outline" onClick={doReport} disabled={busy !== null || !analysis}><Download size={16} />{busy === "report" ? "Preparing…" : "PDF report"}</Button>
          <Button variant="destructive" onClick={doDelete} disabled={busy !== null}><Trash2 size={16} />Delete</Button>
        </div>
      </Card>
      {/* floating, so that a message never shifts the canvas under the user's pointer */}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[1250] w-[min(32rem,92vw)] -translate-x-1/2">
        {message && <div className="pointer-events-auto rounded-xl shadow-xl"><Alert tone={message.tone}>{message.text}</Alert></div>}
      </div>
      {ws.analysisError && <Alert tone="error">{ws.analysisError}</Alert>}
      {net.map_meta?.notes?.length ? (
        <Alert tone="info">
          <details open={!net.id} data-testid="map-notes">
            <summary className="cursor-pointer font-semibold">How this network was built from OpenStreetMap ({net.map_meta.notes.length} note{net.map_meta.notes.length > 1 ? "s" : ""})</summary>
            <ul className="mt-1 list-disc pl-5">{net.map_meta.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </details>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-2 dark:border-navy-700" role="toolbar" aria-label="Network editing">
            {editing ? <>
              {tool("select", "Select", MousePointer2)}{tool("add", "Add junction", PlusCircle)}{tool("connect", "Connect roads", Link2)}
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={parallel} onChange={(e) => setParallel(e.target.checked)} />parallel roads</label>
              <span className="text-xs text-slate-500">{connectFrom ? "Now click the end junction." : HINT[mode]}{net.method === "map" && mode === "add" && " Clicking a road splits it."}</span>
            </> : <span className="text-xs text-slate-500">Read-only view. Press “Edit” to change the network.</span>}
          </div>
          <div className="relative h-[62dvh] min-h-[380px] xl:h-[600px]" data-testid="graph-area">
            {net.method === "map" ? (
              <NetworkMap net={net} editable={editing} mode={mode} selected={selected} connectFrom={connectFrom} flows={flows}
                onSelect={setSelected} onJunctionClick={junctionClick}
                onAddAt={({ lat, lng }) => { const out = addJunction(net, { x: 0, y: 0, lat, lng }); setNet(out.net); setSelected({ kind: "junction", key: out.key }); }}
                onSplit={(road, at) => { const out = splitRoadAt(net, road, at); if (out.error) setMessage({ tone: "error", text: out.error }); else { setNet(out.net); setSelected({ kind: "junction", key: out.key! }); } }} />
            ) : (
              <ManualCanvas net={net} editable={editing} mode={mode} selected={selected} connectFrom={connectFrom} flows={flows}
                onSelect={setSelected} onJunctionClick={junctionClick} onConnect={connect}
                onMove={(key, x, y) => setNet(updateJunction(net, key, { x, y }))}
                onAddAt={(p) => { const out = addJunction(net, p); setNet(out.net); setSelected(null); }} />
            )}
            {net.junctions.length === 0 && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
                <div className="max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white/90 p-5 text-center text-sm text-slate-600 dark:bg-navy-900/90 dark:text-slate-300">
                  <p className="font-semibold text-navy-900 dark:text-white">Empty workspace</p>
                  <ol className="mt-2 list-decimal pl-5 text-left">
                    <li>With <b>Add junction</b> selected, click anywhere to create junctions.</li>
                    <li>Choose <b>Connect roads</b> and click two junctions (or drag from a junction's blue dot).</li>
                    <li>Select a junction or road to set demands and measured flows.</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
          <div className={cn("border-t border-slate-200 px-3 py-2 dark:border-navy-700")}><Legend /></div>
        </Card>
        <PropertiesPanel net={net} setNet={setNet} selected={selected} onSelect={setSelected} editable={editing} flows={flows}
          allowParallel={parallel} onError={(text) => setMessage({ tone: "error", text })} />
      </div>

      <div ref={analysisRef} className="scroll-mt-4">
        <AnalysisSections net={net} ws={ws} a={analysis} solution={solution} auto={auto} flows={flows} />
      </div>
    </div>
  );
}
