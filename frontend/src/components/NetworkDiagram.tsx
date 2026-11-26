import { roadFlows } from "@/lib/graph";
import type { NetworkDraft } from "@/lib/types";

export interface EdgeStyle { label?: string; color?: string; bold?: boolean }

/** Static SVG drawing of a network (final result, circulations, presentation).
 *  Map networks are drawn from their real road geometry; manual ones from canvas positions. */
export function NetworkDiagram({ net, styles, height = 280, showDemand = true }: {
  net: NetworkDraft; styles?: Record<string, EdgeStyle>; height?: number; showDemand?: boolean;
}) {
  if (!net.junctions.length) return <div className="text-sm text-slate-400">No junctions</div>;
  const geo = net.junctions.every((j) => j.lat != null && j.lng != null);
  const lat0 = geo ? net.junctions[0].lat! : 0;
  const k = Math.cos((lat0 * Math.PI) / 180) * 111320;
  const project = (lat: number, lng: number) => ({ x: (lng - net.junctions[0].lng!) * k, y: -(lat - lat0) * 110540 });
  const raw = Object.fromEntries(net.junctions.map((j) => [j.key, geo ? project(j.lat!, j.lng!) : { x: j.x, y: j.y }]));
  const shapes = Object.fromEntries(net.roads.map((r) => [r.key,
    geo && r.geometry ? r.geometry.map((p) => project(p[0], p[1])) : [raw[r.source], raw[r.target]]]));
  const all = [...Object.values(raw), ...Object.values(shapes).flat()].filter(Boolean);
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y));
  // scale geography to a ~700 unit canvas; manual canvases already use screen units
  const s = geo ? 640 / Math.max(maxX - minX, maxY - minY, 1) : 1;
  const at = (p: { x: number; y: number }) => ({ x: (p.x - minX) * s + 50, y: (p.y - minY) * s + 50 });
  const W = (maxX - minX) * s + 100, H = (maxY - minY) * s + 110;
  const many = net.junctions.length > 14;
  const u = Math.max(1, W / 520); // keep text and circles readable when a large drawing is shrunk to fit
  const R = (many ? 9 : 19) * u;
  const flows = roadFlows(net, null, null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ height }} className="w-full" role="img" aria-label={`Diagram of ${net.name}`}>
      {net.roads.map((r) => {
        const line = shapes[r.key]?.filter(Boolean).map(at);
        if (!line || line.length < 2) return null;
        const style = styles?.[r.key];
        const color = style?.color ?? "#1d4ed8";
        const twin = net.roads.some((o) => o.source === r.target && o.target === r.source);
        const a = line[0], b = line[line.length - 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const off = twin ? (many ? 3.5 : 7) * u : 0;
        const pts = line.map((p) => ({ x: p.x - ((b.y - a.y) / len) * off, y: p.y + ((b.x - a.x) / len) * off }));
        // arrow and label at the middle of the drawn path
        const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
        let half = segs.reduce((x, y) => x + y, 0) / 2, i = 0;
        while (i < segs.length - 1 && half > segs[i]) half -= segs[i++];
        const t = segs[i] ? half / segs[i] : 0;
        const mid = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
        const angle = (Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x) * 180) / Math.PI;
        const label = style?.label ?? flows[r.key].text;
        const size = (many ? 5 : 9) * u;
        return (
          <g key={r.key}>
            <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth={(style?.bold ? (many ? 3 : 4) : many ? 1.5 : 2.2) * u} />
            <path data-arrow d={`M${size},0 L${-size},${-size * 0.7} L${-size},${size * 0.7} z`} fill={color} transform={`translate(${mid.x},${mid.y}) rotate(${angle})`} />
            {label && <text x={mid.x} y={mid.y - (many ? 6 : 10) * u} fontSize={(many ? 8 : 13) * u} fontWeight="600" textAnchor="middle" fill={color}
              stroke="white" strokeWidth={3 * u} paintOrder="stroke">{label}</text>}
          </g>
        );
      })}
      {net.junctions.map((j) => {
        const p = at(raw[j.key]);
        const d = Number(j.net_demand);
        const fill = j.node_type === "pickup" ? "#15803d" : j.node_type === "destination" ? "#b91c1c" : "#0b1f3a";
        return (
          <g key={j.key}>
            <circle cx={p.x} cy={p.y} r={R} fill={fill} />
            <text x={p.x} y={p.y + (many ? 3 : 4) * u} textAnchor="middle" fontSize={(many ? 7 : 12) * u} fontWeight="700" fill="white">{j.name.slice(0, 4)}</text>
            {showDemand && d !== 0 && (
              <text x={p.x} y={p.y + R + (many ? 9 : 14) * u} textAnchor="middle" fontSize={(many ? 8 : 12) * u} fontWeight="600" fill="#0891b2">
                D = {j.net_demand}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
