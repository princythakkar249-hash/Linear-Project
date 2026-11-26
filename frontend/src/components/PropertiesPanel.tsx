import { ArrowLeftRight, Trash2, X } from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label } from "@/components/ui/ui";
import { FLOW_COLORS, FLOW_LABELS, oppositeRoads, removeJunction, removeRoad, reverseRoad, setEndpoints, setTwoWay, updateJunction, updateRoad, type RoadFlow } from "@/lib/graph";
import type { NetworkDraft } from "@/lib/types";
import { useMedia } from "@/lib/useMedia";
import { cn } from "@/lib/utils";
import type { Selection } from "./ManualCanvas";

/** Details and editing for the selected junction or road. A bottom sheet on small screens. */
export function PropertiesPanel({ net, setNet, selected, onSelect, editable, flows, allowParallel, onError }: {
  net: NetworkDraft; setNet: (n: NetworkDraft) => void; selected: Selection; onSelect: (s: Selection) => void;
  editable: boolean; flows: Record<string, RoadFlow>; allowParallel: boolean; onError: (message: string) => void;
}) {
  const compact = useMedia("(max-width: 1279px)");
  const junction = selected?.kind === "junction" ? net.junctions.find((j) => j.key === selected.key) : undefined;
  const road = selected?.kind === "road" ? net.roads.find((r) => r.key === selected.key) : undefined;
  const name = (k: string) => net.junctions.find((j) => j.key === k)?.name ?? k;
  const sheet = compact && (junction || road);
  const connected = junction ? net.roads.filter((r) => r.source === junction.key || r.target === junction.key) : [];
  const twoWay = road ? oppositeRoads(net, road).length > 0 : false;

  const move = (key: string, source: string, target: string) => {
    const out = setEndpoints(net, key, source, target, allowParallel);
    if (out.error) onError(out.error); else setNet(out.net);
  };
  // Reversing one side of a two-way street would give two roads in the same direction.
  const reverseBlocked = twoWay && !allowParallel;

  return (
    <Card data-testid="properties" className={cn("relative h-fit", sheet && "fixed inset-x-2 bottom-2 z-[1000] max-h-[48dvh] overflow-y-auto border-brand-500 shadow-2xl")}>
      <CardContent className="space-y-3 pt-4 text-sm">
        {sheet && <button aria-label="Close panel" className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-lg hover:bg-slate-100" onClick={() => onSelect(null)}><X size={18} /></button>}
        {!junction && !road && <p className="text-slate-500">Select a junction or road to see its details{editable ? " and edit it" : ""}.</p>}

        {junction && <>
          <h3 className="font-semibold">Junction {junction.name}</h3>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="neutral">{(junction.node_type ?? "junction").replace("_", " ")}</Badge>
            <Badge tone="blue">{connected.length} road(s)</Badge>
          </div>
          {junction.lat != null && <p className="font-mono text-xs text-slate-500">{junction.lat.toFixed(6)}, {junction.lng!.toFixed(6)}</p>}
          <div><Label htmlFor="jn">Name</Label><Input id="jn" disabled={!editable} value={junction.name} onChange={(e) => setNet(updateJunction(net, junction.key, { name: e.target.value }))} /></div>
          <div><Label htmlFor="jd">Net external demand D (+ vehicles leave here, − enter)</Label>
            <Input id="jd" inputMode="decimal" disabled={!editable} value={junction.net_demand} onChange={(e) => setNet(updateJunction(net, junction.key, { net_demand: e.target.value }))} />
            <p className="mt-1 text-xs text-slate-500">Used in: incoming − outgoing = D</p></div>
          {connected.length > 0 && <div className="max-h-32 overflow-y-auto">
            {connected.map((r) => <button key={r.key} className="block w-full truncate text-left text-xs text-brand-700 hover:underline" onClick={() => onSelect({ kind: "road", key: r.key })}>
              {name(r.source)} → {name(r.target)} {r.label && `· ${r.label}`}</button>)}
          </div>}
          {editable && <Button variant="destructive" size="sm" onClick={() => { setNet(removeJunction(net, junction.key)); onSelect(null); }}>
            <Trash2 size={14} />Delete junction{connected.length ? ` and ${connected.length} road(s)` : ""}</Button>}
        </>}

        {road && <>
          <h3 className="font-semibold">Road {name(road.source)} → {name(road.target)}</h3>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: FLOW_COLORS[flows[road.key]?.kind ?? "unresolved"] }}>{FLOW_LABELS[flows[road.key]?.kind ?? "unresolved"]}</span>
            <Badge tone="blue">{flows[road.key]?.text}</Badge>
            <Badge>{twoWay ? "two-way street" : "one-way"}</Badge>
            {road.origin === "osm" ? <Badge tone="cyan">OpenStreetMap{road.highway && ` · ${road.highway}`}</Badge> : <Badge>added by hand</Badge>}
          </div>
          <div><Label htmlFor="rl">Road name</Label><Input id="rl" disabled={!editable} placeholder="Unnamed road" value={road.label} onChange={(e) => setNet(updateRoad(net, road.key, { label: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-2">
            {(["source", "target"] as const).map((end) => (
              <div key={end}><Label htmlFor={`road-${end}`}>{end === "source" ? "Starting junction" : "Ending junction"}</Label>
                <select id={`road-${end}`} disabled={!editable} value={road[end]} className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 disabled:opacity-60 dark:border-navy-700 dark:bg-navy-800"
                  onChange={(e) => move(road.key, end === "source" ? e.target.value : road.source, end === "target" ? e.target.value : road.target)}>
                  {net.junctions.map((j) => <option key={j.key} value={j.key}>{j.name}</option>)}
                </select></div>))}
          </div>
          {road.osm_way_id && <p className="text-xs text-slate-500">OSM way <a className="text-brand-700 underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/way/${road.osm_way_id}`}>{road.osm_way_id}</a></p>}
          <div><Label htmlFor="rm">Length in metres (optional)</Label>
            <Input id="rm" type="number" min={0} disabled={!editable} value={road.length_m ?? ""} onChange={(e) => setNet(updateRoad(net, road.key, { length_m: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) }))} /></div>
          <label className="flex items-center gap-2">
            <input type="checkbox" data-testid="known-toggle" disabled={!editable} checked={road.known_flow !== null} onChange={(e) => setNet(updateRoad(net, road.key, { known_flow: e.target.checked ? "0" : null }))} />
            Flow is known (measured by a sensor)
          </label>
          {road.known_flow !== null
            ? <div><Label htmlFor="rf">Measured flow (≥ 0)</Label><Input id="rf" inputMode="decimal" disabled={!editable} value={road.known_flow} onChange={(e) => setNet(updateRoad(net, road.key, { known_flow: e.target.value }))} /></div>
            : <p className="text-xs text-slate-500">Unknown flow: variable <b>{flows[road.key]?.variable}</b></p>}
          {editable && <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={reverseBlocked} onClick={() => setNet(reverseRoad(net, road.key))}><ArrowLeftRight size={14} />Reverse direction</Button>
            <Button variant="outline" size="sm" onClick={() => setNet(setTwoWay(net, road.key, !twoWay))}>{twoWay ? "Make one-way" : "Make two-way"}</Button>
            <Button variant="destructive" size="sm" onClick={() => { setNet(removeRoad(net, road.key)); onSelect(null); }}><Trash2 size={14} />Delete road</Button>
          </div>}
          {editable && reverseBlocked && <p className="text-xs text-slate-500">This is a two-way street. Make it one-way before reversing it.</p>}
          {editable && road.origin === "osm" && <p className="text-xs text-amber-700">Changing the direction of an OpenStreetMap road overrides the real one-way rule.</p>}
        </>}
      </CardContent>
    </Card>
  );
}
