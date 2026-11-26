import {
  Background, BaseEdge, Controls, EdgeLabelRenderer, Handle, Position, ReactFlow, ReactFlowProvider, useInternalNode,
  useNodesState, useReactFlow, type Connection, type EdgeProps, type Node, type NodeProps,
} from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";
import { demandText, FLOW_COLORS, type RoadFlow } from "@/lib/graph";
import type { NetworkDraft } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Mode = "select" | "add" | "connect";
export type Selection = { kind: "junction" | "road"; key: string } | null;
export interface CanvasProps {
  net: NetworkDraft; editable: boolean; mode: Mode; selected: Selection; connectFrom: string | null;
  flows: Record<string, RoadFlow>;
  onSelect: (s: Selection) => void; onAddAt: (p: { x: number; y: number }) => void;
  onMove: (key: string, x: number, y: number) => void;
  onConnect: (source: string, target: string) => void; onJunctionClick: (key: string) => void;
}

const SIZE = 56, RADIUS = 28;

function JunctionNode({ data }: NodeProps) {
  const d = data as { name: string; demand: string; selected: boolean; source: boolean; editable: boolean; type: string };
  return (
    <div data-testid="junction-node" className={cn("relative grid h-14 w-14 place-items-center rounded-full text-xs font-bold text-white shadow-lg ring-offset-2",
      d.type === "pickup" ? "bg-green-700" : d.type === "destination" ? "bg-red-700" : "bg-navy-900",
      d.selected && "ring-4 ring-cyan2-400", d.source && "ring-4 ring-amber-400")}>
      <Handle type="target" position={Position.Top} isConnectableStart={false} style={{ inset: 0, width: "100%", height: "100%", transform: "none", opacity: 0, borderRadius: "50%" }} />
      <Handle type="source" position={Position.Right} title="Drag to another junction to create a road" className="tfna-src"
        style={{ right: -9, width: 14, height: 14, background: "#22d3ee", border: "2px solid white", display: d.editable ? undefined : "none" }} />
      {d.name.slice(0, 5)}
      {d.demand && <span className="absolute -bottom-5 whitespace-nowrap text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">{d.demand}</span>}
    </div>
  );
}

/** Floating directed edge: always computed from the two NODE objects, so it follows them when they move. */
function RoadEdge({ id, source, target, data }: EdgeProps) {
  const s = useInternalNode(source), t = useInternalNode(target);
  if (!s || !t) return null;
  const centre = (n: typeof s) => ({ x: n.internals.positionAbsolute.x + (n.measured.width ?? SIZE) / 2, y: n.internals.positionAbsolute.y + (n.measured.height ?? SIZE) / 2 });
  const a = centre(s), b = centre(t);
  const d = data as { offset: number; text: string; color: string; name: string; selected: boolean };
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
  const cx = (a.x + b.x) / 2 - uy * d.offset * 2, cy = (a.y + b.y) / 2 + ux * d.offset * 2; // control point
  const from = Math.atan2(cy - a.y, cx - a.x), to = Math.atan2(b.y - cy, b.x - cx);
  const x1 = a.x + Math.cos(from) * RADIUS, y1 = a.y + Math.sin(from) * RADIUS;
  const x2 = b.x - Math.cos(to) * (RADIUS + 2), y2 = b.y - Math.sin(to) * (RADIUS + 2);
  const lx = 0.25 * x1 + 0.5 * cx + 0.25 * x2, ly = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
  const color = d.selected ? "#0891b2" : d.color;
  const head = `M${x2},${y2} L${x2 - 13 * Math.cos(to - 0.45)},${y2 - 13 * Math.sin(to - 0.45)} L${x2 - 13 * Math.cos(to + 0.45)},${y2 - 13 * Math.sin(to + 0.45)} z`;
  return (
    <>
      <BaseEdge id={id} path={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`} style={{ stroke: color, strokeWidth: d.selected ? 4 : 2.4 }} interactionWidth={28} />
      <path d={head} fill={color} data-arrow />
      <EdgeLabelRenderer>
        <div className="nodrag nopan pointer-events-none absolute whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold shadow-sm" data-testid="flow-label"
          style={{ color, transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }}>
          {d.text}{d.name && <span className="ml-1 font-normal text-slate-500">· {d.name}</span>}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { junction: JunctionNode };
const edgeTypes = { road: RoadEdge };

function Canvas(p: CanvasProps) {
  const { net, editable, mode, selected, connectFrom, flows } = p;
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const rf = useReactFlow();
  const fitted = useRef(false);

  useEffect(() => {
    setNodes((prev) => net.junctions.map((j) => ({
      ...(prev.find((n) => n.id === j.key) ?? {}), id: j.key, type: "junction", position: { x: j.x, y: j.y },
      data: { name: j.name, demand: demandText(j.net_demand), selected: selected?.kind === "junction" && selected.key === j.key,
        source: connectFrom === j.key, editable, type: j.node_type ?? "junction" },
    })));
  }, [net.junctions, selected, connectFrom, editable, setNodes]);

  // Fit once when a saved network appears; never re-fit while the user is drawing.
  useEffect(() => {
    if (fitted.current || nodes.length === 0 || !nodes[0].measured) return;
    fitted.current = true;
    if (nodes.length > 1) rf.fitView({ padding: 0.25, maxZoom: 1.3 });
  }, [nodes, rf]);

  const edges = useMemo(() => {
    const seen: Record<string, number> = {};
    return net.roads.map((r) => {
      const pair = `${r.source}>${r.target}`;
      const index = seen[pair] ?? 0;
      seen[pair] = index + 1;
      const twin = net.roads.some((o) => o.source === r.target && o.target === r.source);
      const flow = flows[r.key];
      return { id: r.key, source: r.source, target: r.target, type: "road",
        data: { offset: (twin ? 14 : 0) + index * 28, text: flow?.text ?? "", color: FLOW_COLORS[flow?.kind ?? "unresolved"],
          name: net.roads.length <= 16 ? r.label : "", selected: selected?.kind === "road" && selected.key === r.key } };
    });
  }, [net.roads, selected, flows]);

  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange}
      nodesDraggable={editable} nodesConnectable={editable}
      onNodeDragStop={(_, n) => p.onMove(n.id, Math.round(n.position.x), Math.round(n.position.y))}
      onConnect={(c: Connection) => c.source && c.target && p.onConnect(c.source, c.target)}
      onNodeClick={(_, n) => p.onJunctionClick(n.id)}
      onEdgeClick={(_, e) => p.onSelect({ kind: "road", key: e.id })}
      onPaneClick={(e) => {
        if (editable && mode === "add") { const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }); p.onAddAt({ x: at.x - RADIUS, y: at.y - RADIUS }); }
        else p.onSelect(null);
      }}
      deleteKeyCode={null} zoomOnDoubleClick={false} minZoom={0.2} maxZoom={2.5}
      className={cn(editable && mode === "add" && "[&_.react-flow__pane]:!cursor-crosshair")}>
      <Background gap={20} /><Controls showInteractive={false} />
    </ReactFlow>
  );
}

export default function ManualCanvas(p: CanvasProps) {
  return <ReactFlowProvider><Canvas {...p} /></ReactFlowProvider>;
}
