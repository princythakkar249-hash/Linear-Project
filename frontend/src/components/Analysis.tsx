/** The complete mathematical analysis, in order, on the same page as the network. */
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Matrix } from "@/components/Matrix";
import { NetworkDiagram, type EdgeStyle } from "@/components/NetworkDiagram";
import { Alert, Badge, Button, Card, Input, Label } from "@/components/ui/ui";
import { FLOW_COLORS, FLOW_LABELS, replay, toNumber, type FlowKind, type RoadFlow } from "@/lib/graph";
import type { Analysis as A, NetworkDraft, SolutionInfo, Step } from "@/lib/types";
import type { Workspace } from "@/lib/useWorkspace";
import { cn } from "@/lib/utils";

export const SECTIONS = [
  ["validation", "Network validation"], ["junctions", "Junction details"], ["equations", "Traffic conservation equations"],
  ["coefficient", "Coefficient matrix"], ["augmented", "Augmented matrix"], ["gaussian", "Gaussian elimination"],
  ["history", "Row operation history"], ["echelon", "REF and RREF"], ["rank", "Matrix rank"], ["pivots", "Pivot and free variables"],
  ["classification", "Solution classification"], ["general", "General solution"], ["nullspace", "Null space basis"],
  ["example", "Example solution"], ["final", "Final traffic network"],
] as const;
type Id = (typeof SECTIONS)[number][0];
const OPEN_BY_DEFAULT: Id[] = ["validation", "equations", "augmented", "classification", "general", "example", "final"];

function Section({ id, open, toggle, children, extra }: { id: Id; open: boolean; toggle: (id: Id) => void; children: () => ReactNode; extra?: ReactNode }) {
  const index = SECTIONS.findIndex((s) => s[0] === id);
  return (
    <Card id={`sec-${id}`} className="scroll-mt-16">
      <h2>
        <button className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open} aria-controls={`body-${id}`} onClick={() => toggle(id)}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{index + 1}</span>
          <span className="flex-1 font-semibold">{SECTIONS[index][1]}</span>{extra}
          <ChevronDown size={18} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
        </button>
      </h2>
      {open && <div id={`body-${id}`} className="border-t border-slate-100 px-4 py-4 dark:border-navy-700">{children()}</div>}
    </Card>
  );
}

/** Step through (or list) the row operations; each intermediate matrix is rebuilt from the changed rows. */
function StepPlayer({ a, steps, offset }: { a: A; steps: Step[]; offset: number }) {
  const [i, setI] = useState(0);
  const index = Math.min(i, steps.length - 1);
  const s = steps[index];
  if (!s) return <p className="text-sm text-slate-500">No row operations were needed.</p>;
  const cols = [...a.matrix.variables, "B"];
  return (
    <div className="space-y-3" data-testid="step-player">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" aria-label="Previous step" disabled={index === 0} onClick={() => setI(index - 1)}><ChevronLeft size={16} /></Button>
        <span className="text-sm">Operation <b>{index + 1}</b> of {steps.length}</span>
        <Button size="icon" variant="outline" aria-label="Next step" disabled={index >= steps.length - 1} onClick={() => setI(index + 1)}><ChevronRight size={16} /></Button>
        <input aria-label="Jump to operation" type="range" min={0} max={steps.length - 1} value={index} onChange={(e) => setI(Number(e.target.value))} className="w-40" />
        <Badge tone={s.phase === "forward" ? "blue" : "cyan"}>{s.phase === "forward" ? "Gaussian (forward)" : "Gauss-Jordan (backward)"}</Badge>
      </div>
      <p className="text-sm">{s.description}</p>
      <p className="eq font-semibold text-brand-700">{s.notation}</p>
      <Matrix data={replay(a.matrix.augmented, a.reduction.steps, offset + index + 1)} cols={cols} augment highlight={s.pivot} />
    </div>
  );
}

function History({ a }: { a: A }) {
  const [open, setOpen] = useState<number | null>(null);
  const [limit, setLimit] = useState(60);
  const steps = a.reduction.steps;
  if (!steps.length) return <p className="text-sm text-slate-500">No row operations were needed.</p>;
  return (
    <div className="space-y-1">
      <ol className="space-y-1">
        {steps.slice(0, limit).map((s, i) => (
          <li key={s.index} className="rounded-lg border border-slate-100 dark:border-navy-700">
            <button className="flex w-full flex-wrap items-center gap-3 px-3 py-1.5 text-left text-sm" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span className="w-10 text-slate-400">{s.index}.</span>
              <span className="eq font-semibold text-brand-700">{s.notation}</span>
              <span className="text-xs text-slate-500">{s.description}</span>
            </button>
            {open === i && <div className="px-3 pb-3"><Matrix data={replay(a.matrix.augmented, steps, i + 1)} cols={[...a.matrix.variables, "B"]} augment highlight={s.pivot} /></div>}
          </li>
        ))}
      </ol>
      {steps.length > limit && <Button variant="outline" size="sm" onClick={() => setLimit(limit + 200)}>Show more ({steps.length - limit} remaining)</Button>}
      <p className="text-xs text-slate-500">Click an operation to see the matrix immediately after it.</p>
    </div>
  );
}

function Circulations({ a, net }: { a: A; net: NetworkDraft }) {
  const [shown, setShown] = useState(4);
  const nb = a.analysis.null_basis;
  const vars = a.matrix.variables;
  if (!nb.length) return <p className="text-sm">Nullity = 0, so the null space is {"{0}"}: no circulating traffic is possible on the unknown roads.</p>;
  return (
    <div className="space-y-4">
      <Alert tone="info"><b>AX = 0.</b> A null-space vector is a change in road flows that leaves every junction balanced, traffic circulating around a loop. Adding any multiple of it to a solution gives another solution. Measured roads cannot change.</Alert>
      <div className="grid gap-4 lg:grid-cols-2">
        {nb.slice(0, shown).map((b, k) => {
          const styles: Record<string, EdgeStyle> = {};
          for (const r of net.roads) styles[r.key] = { color: "#cbd5e1", label: "" };
          const parts = a.circulations[k].roads.map((c) => {
            const up = toNumber(c.coefficient) > 0;
            styles[c.road_key] = { color: up ? "#059669" : "#dc2626", label: `${c.variable}: ${up ? "+" : ""}${c.coefficient}`, bold: true };
            const r = net.roads.find((x) => x.key === c.road_key)!;
            const nm = (key: string) => net.junctions.find((j) => j.key === key)?.name;
            return `${c.variable} (${nm(r.source)}→${nm(r.target)}) ${up ? "+" : "−"}${Math.abs(toNumber(c.coefficient))}`;
          });
          return (
            <div key={b.parameter} className="rounded-xl border border-slate-200 p-3 dark:border-navy-700" data-testid="null-vector">
              <h4 className="font-semibold">{b.parameter}: free variable {b.free_variable}</h4>
              {vars.length <= 12
                ? <div className="my-2 flex items-center gap-3"><Matrix data={vars.map((_, i) => [b.vector[i]])} rowLabels={vars} /></div>
                : <p className="eq my-2 break-words">v = ({b.vector.join(", ")})</p>}
              <NetworkDiagram net={net} styles={styles} height={300} showDemand={false} />
              <p className="mt-2 text-sm">Raising {b.parameter} by 1 changes: {parts.join("; ")}. Green roads gain, red roads lose.</p>
            </div>
          );
        })}
      </div>
      {nb.length > shown && <Button variant="outline" size="sm" onClick={() => setShown(shown + 6)}>Show more basis vectors ({nb.length - shown} remaining)</Button>}
    </div>
  );
}

function Parameters({ a, ws, solution, auto }: { a: A; ws: Workspace; solution: SolutionInfo; auto: boolean }) {
  const free = a.analysis.free_variables;
  const [all, setAll] = useState(false);
  const set = (name: string, value: string) => ws.setParams({ ...solution.parameters, ...ws.params, [name]: value });
  const visible = all ? free : free.slice(0, 8);
  return (
    <div className="space-y-3">
      {free.length > 0 && <>
        {auto && <Alert tone="info">With every parameter at 0 some flow would be negative, so a <b>feasible example</b> is shown instead. Edit any value below.</Alert>}
        <div className="flex flex-wrap gap-3">
          {visible.map((f, i) => {
            const range = a.feasibility.ranges[f];
            return (
              <div key={f} className="w-32">
                <Label htmlFor={`p-${f}`}>{f} = t{i + 1}</Label>
                <Input id={`p-${f}`} inputMode="decimal" value={ws.params[f] ?? solution.parameters[f] ?? "0"} onChange={(e) => set(f, e.target.value)} />
                {range && <p className="mt-0.5 text-[11px] text-slate-500">feasible {range.min} … {range.max ?? "∞"}</p>}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {free.length > 8 && <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${free.length} parameters`}</Button>}
          {a.feasible_example && <Button variant="outline" size="sm" onClick={() => ws.setParams(a.feasible_example!.parameters)}>Use a feasible example</Button>}
          <Button variant="ghost" size="sm" onClick={() => ws.setParams(Object.fromEntries(free.map((f) => [f, "0"])))}>Set all to 0</Button>
        </div>
      </>}
    </div>
  );
}

export function AnalysisSections({ net, ws, a, solution, auto, flows }: {
  net: NetworkDraft; ws: Workspace; a: A | null; solution: SolutionInfo | null; auto: boolean; flows: Record<string, RoadFlow>;
}) {
  const [open, setOpen] = useState<Set<Id>>(() => new Set(OPEN_BY_DEFAULT));
  const toggle = (id: Id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const jump = (id: Id) => { setOpen((s) => new Set(s).add(id)); setTimeout(() => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth" }), 30); };
  const v = ws.validation;
  const section = (id: Id, children: () => ReactNode, extra?: ReactNode) =>
    <Section key={id} id={id} open={open.has(id)} toggle={toggle} extra={extra}>{children}</Section>;
  const name = (k: string) => net.junctions.find((j) => j.key === k)?.name ?? k;

  const validation = section("validation", () => (
    <div className="space-y-4 text-sm">
      {v && <>
        <p>{v.counts.junctions} junctions · {v.counts.roads} roads · {v.counts.components} connected part(s)</p>
        {v.errors.map((e, i) => <Alert key={`e${i}`} tone="error"><XCircle size={15} className="mr-2 inline" />{e.message}</Alert>)}
        {v.warnings.map((w, i) => <Alert key={`w${i}`} tone="warn"><AlertTriangle size={15} className="mr-2 inline" />{w.message}</Alert>)}
        {v.ok && !v.warnings.length && <Alert tone="ok"><CheckCircle2 size={15} className="mr-2 inline" />All checks passed.</Alert>}
      </>}
      {a && <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="mb-1 font-semibold">Adjacency lists</h4>
          <div className="max-h-56 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th>Junction</th><th>Out →</th><th>← In</th></tr></thead><tbody>
            {Object.keys(a.graph.adjacency_out).map((k) => <tr key={k} className="border-t border-slate-100 dark:border-navy-700"><td className="py-0.5 pr-2 font-semibold">{k}</td><td className="font-mono">[{a.graph.adjacency_out[k].join(", ")}]</td><td className="font-mono">[{a.graph.adjacency_in[k].join(", ")}]</td></tr>)}
          </tbody></table></div>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge tone={a.graph.weakly_connected ? "green" : "red"}>{a.graph.weakly_connected ? "Weakly connected" : `${a.graph.weak_components.length} disconnected parts`}</Badge>
            <Badge tone={a.graph.strongly_connected ? "green" : "amber"}>{a.graph.strongly_connected ? "Strongly connected" : `${a.graph.strong_components.length} strong components`}</Badge>
            <Badge tone={a.graph.isolated_junctions.length ? "red" : "green"}>{a.graph.isolated_junctions.length ? `Isolated: ${a.graph.isolated_junctions.join(", ")}` : "No isolated junctions"}</Badge>
          </div>
          <div><Label htmlFor="bfs">Breadth-first search from</Label>
            <select id="bfs" className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 dark:bg-navy-800" value={ws.start || net.junctions[0]?.key} onChange={(e) => ws.setStart(e.target.value)}>
              {net.junctions.map((j) => <option key={j.key} value={j.key}>{j.name}</option>)}</select></div>
          <p><b>Directed reachability</b> (follows road directions): <span className="font-mono text-xs">{a.graph.bfs_directed?.order.join(" → ")}</span></p>
          <p>Unreachable by driving: {a.graph.bfs_directed?.unreachable.join(", ") || "none"}</p>
          <p><b>Weak connectivity</b> (ignores directions) misses: {a.graph.bfs_undirected?.unreachable.join(", ") || "none"}</p>
        </div>
      </div>}
    </div>
  ), v && <Badge tone={!v.ok ? "red" : v.warnings.length ? "amber" : "green"}>{!v.ok ? `${v.errors.length} error(s)` : v.warnings.length ? `${v.warnings.length} warning(s)` : "valid"}</Badge>);

  const junctions = section("junctions", () => (
    <div className="max-h-96 overflow-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="text-left text-xs text-slate-500"><th>Junction</th><th>Type</th><th>D</th><th>Incoming from</th><th>Outgoing to</th><th>Streets</th></tr></thead><tbody>
      {net.junctions.map((j) => {
        const into = net.roads.filter((r) => r.target === j.key), out = net.roads.filter((r) => r.source === j.key);
        return <tr key={j.key} className="border-t border-slate-100 align-top dark:border-navy-700"><td className="py-1 pr-2 font-semibold">{j.name}</td><td className="pr-2">{(j.node_type ?? "junction").replace("_", " ")}</td><td className="pr-2 font-mono">{j.net_demand}</td>
          <td className="pr-2">{into.map((r) => name(r.source)).join(", ") || "—"}</td><td className="pr-2">{out.map((r) => name(r.target)).join(", ") || "—"}</td>
          <td className="text-xs text-slate-500">{[...new Set([...into, ...out].map((r) => r.label).filter(Boolean))].join(" · ") || "—"}</td></tr>;
      })}
    </tbody></table></div>
  ));

  if (!a) {
    return (
      <div className="space-y-3">
        {validation}{junctions}
        <Alert tone={v && !v.ok ? "error" : "info"}>
          {v && !v.ok ? "Fix the validation errors above to run the mathematical analysis." : ws.analysisError ?? (ws.loading ? "Solving…" : "Add junctions and roads to see the equations and solution.")}
        </Alert>
      </div>
    );
  }
  const info = a.analysis;
  const vars = a.matrix.variables;
  const cols = [...vars, "B"];
  const rows = net.junctions.map((j) => j.name);
  const forward = a.reduction.steps.filter((s) => s.phase === "forward");

  return (
    <div className="space-y-3">
      <nav aria-label="Analysis sections" className="sticky top-0 z-[500] -mx-1 flex gap-1 overflow-x-auto bg-slate-50/95 px-1 py-2 backdrop-blur dark:bg-navy-950/95">
        {SECTIONS.map(([id, title], i) => <button key={id} onClick={() => jump(id)} className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-xs hover:border-brand-500 dark:border-navy-700 dark:bg-navy-900">{i + 1}. {title}</button>)}
      </nav>
      {validation}
      {junctions}
      {section("equations", () => (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">One equation per junction: <b>incoming flow − outgoing flow = D</b>, where D is the net number of vehicles leaving the network there. Known flows are substituted and moved to the right.</p>
          <div className="max-h-[32rem] space-y-1 overflow-auto">
            {a.equations.map((e) => (
              <details key={e.junction_key} className="rounded-lg border border-slate-200 px-3 py-1.5 dark:border-navy-700">
                <summary className="cursor-pointer text-sm"><b className="mr-3">{e.junction_name}</b><span className="eq" data-testid="equation">{e.text}</span></summary>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <div><b>Incoming</b>{e.incoming.map((r) => <div key={r.road_key}>from {r.from}: {r.variable ?? `known ${r.known_flow}`} {r.label && <span className="text-slate-500">({r.label})</span>}</div>)}{!e.incoming.length && <div className="text-slate-400">none</div>}</div>
                  <div><b>Outgoing</b>{e.outgoing.map((r) => <div key={r.road_key}>to {r.to}: {r.variable ?? `known ${r.known_flow}`} {r.label && <span className="text-slate-500">({r.label})</span>}</div>)}{!e.outgoing.length && <div className="text-slate-400">none</div>}</div>
                  <ol className="list-decimal pl-5 text-slate-600 dark:text-slate-300 sm:col-span-2">{e.derivation.map((d, i) => <li key={i}>{d}</li>)}</ol>
                </div>
              </details>
            ))}
          </div>
        </div>
      ))}
      {section("coefficient", () => (
        <div className="space-y-3">
          <p className="text-sm">AX = B with one row per junction and one column per unknown road. Variable order: <span className="font-mono">{vars.join(", ") || "none"}</span>.</p>
          <div className="flex flex-wrap items-start gap-4">
            <div><div className="text-xs font-semibold">A</div><Matrix data={a.matrix.A} cols={vars} rowLabels={rows} /></div>
            <div><div className="text-xs font-semibold">X</div><Matrix data={vars.map((x) => [x])} /></div>
            <div><div className="text-xs font-semibold">B</div><Matrix data={a.matrix.B.map((b) => [b])} /></div>
          </div>
        </div>
      ))}
      {section("augmented", () => <Matrix data={a.matrix.augmented} cols={cols} rowLabels={rows} augment />)}
      {section("gaussian", () => (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">Forward elimination creates zeros below each pivot and ends in Row Echelon Form.</p>
          <StepPlayer a={a} steps={forward} offset={0} />
          <h4 className="pt-3 text-sm font-semibold">Gauss-Jordan phase (continues from REF to RREF)</h4>
          <StepPlayer a={a} steps={a.reduction.steps.slice(forward.length)} offset={forward.length} />
        </div>
      ), <Badge>{forward.length} + {a.reduction.steps.length - forward.length} steps</Badge>)}
      {section("history", () => <History a={a} />, <Badge>{a.reduction.steps.length}</Badge>)}
      {section("echelon", () => (
        <div className="grid gap-4 xl:grid-cols-2">
          <div><h4 className="mb-1 text-sm font-semibold">REF (Gaussian elimination)</h4><Matrix data={a.reduction.ref} cols={cols} augment /></div>
          <div><h4 className="mb-1 text-sm font-semibold">RREF (Gauss-Jordan elimination)</h4><Matrix data={a.reduction.rref} cols={cols} augment /></div>
        </div>
      ))}
      {section("rank", () => (
        <p className="text-sm">rank(A) = <b>{info.rank}</b>, the number of independent equations (out of {info.n_equations}). Unknowns n = {info.n_unknowns}, nullity = n − rank = <b>{info.nullity}</b>.
          {!info.consistent && <> Since row(s) {info.inconsistent_rows.join(", ")} of the RREF read 0 = nonzero, rank [A|B] = {info.rank + 1} &gt; rank A.</>}</p>
      ), <Badge tone="blue">rank {info.rank}</Badge>)}
      {section("pivots", () => (
        <dl className="space-y-1 text-sm">
          <div><dt className="inline font-semibold">Pivot columns: </dt><dd className="inline">{info.pivot_columns.join(", ") || "none"}</dd></div>
          <div><dt className="inline font-semibold">Pivot variables: </dt><dd className="inline font-mono">{info.pivot_variables.join(", ") || "none"}</dd></div>
          <div><dt className="inline font-semibold">Free variables: </dt><dd className="inline font-mono" data-testid="free-variables">{info.free_variables.join(", ") || "none"}</dd></div>
        </dl>
      ))}
      {section("classification", () => (
        <div className="space-y-2">
          <Alert tone={info.classification === "none" ? "error" : "info"}>{a.conclusion}</Alert>
          <p className="flex items-center gap-1.5 text-sm">{a.verification.all_passed ? <CheckCircle2 className="text-emerald-600" size={16} /> : <XCircle className="text-red-600" size={16} />}
            {a.verification.all_passed ? "Verified: AX = B, Av = 0, rank-nullity and an independent SymPy cross-check." : "Verification failed."}</p>
        </div>
      ), <Badge tone={info.classification === "unique" ? "green" : info.classification === "infinite" ? "amber" : "red"}>{{ unique: "Unique solution", infinite: "Infinitely many solutions", none: "Inconsistent" }[info.classification]}</Badge>)}
      {section("general", () => !info.consistent ? <p className="text-sm">There is no solution to express.</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          <div><h4 className="mb-1 text-sm font-semibold">{info.free_variables.length ? "Pivot variables in terms of the free parameters" : "Solution"}</h4>
            <div className="max-h-80 overflow-auto">{info.general_solution.map((g) => <div key={g.variable} className="eq" data-testid="general-line">{g.text}</div>)}</div></div>
          <div><h4 className="mb-1 text-sm font-semibold">Nonnegativity constraints on the parameters</h4>
            {info.constraints.length ? <div className="max-h-80 overflow-auto">{info.constraints.map((c) => <div key={c.variable} className="eq">{c.variable}: {c.text}</div>)}</div> : <p className="text-sm text-slate-500">No parameters.</p>}
            <p className="mt-2 text-sm">Is any nonnegative solution possible? <Badge tone={a.feasibility.exists ? "green" : "red"}>{a.feasibility.exists ? "Yes" : "No"}</Badge></p></div>
        </div>
      ))}
      {section("nullspace", () => <Circulations a={a} net={net} />, <Badge>{info.null_basis.length} vector(s)</Badge>)}
      {section("example", () => !solution ? <p className="text-sm">The system is inconsistent, so there is no example solution.</p> : (
        <div className="space-y-3">
          <Parameters a={a} ws={ws} solution={solution} auto={auto} />
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">Mathematically valid (satisfies AX = B)</Badge>
            <Badge tone={solution.physically_feasible ? "green" : "red"}>{solution.physically_feasible ? "Physically feasible" : `Not physically feasible: ${solution.negative_variables.join(", ")} negative`}</Badge>
          </div>
          {!solution.physically_feasible && <Alert tone="warn">A negative value means traffic would have to drive against the road's direction. The values are shown as computed, not replaced by zero.
            {a.feasibility.exists ? " Choose different parameter values." : " No choice of parameters avoids this: check the demands and measured flows."}</Alert>}
          {solution.roads.length <= 40 && <div className="h-56"><ResponsiveContainer><BarChart data={solution.roads.map((r) => ({ name: `${r.from}→${r.to}`, flow: toNumber(r.value), known: r.known }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip />
            <Bar dataKey="flow" isAnimationActive={false}>{solution.roads.map((r, i) => <Cell key={i} fill={r.negative ? FLOW_COLORS.negative : r.known ? FLOW_COLORS.known : FLOW_COLORS.determined} />)}</Bar>
          </BarChart></ResponsiveContainer></div>}
          {a.feasibility.ranges_skipped && <p className="text-xs text-slate-500">Per-road minimum and maximum are not computed for systems this large.</p>}
        </div>
      ))}
      {section("final", () => (
        <div className="space-y-3">
          <NetworkDiagram net={net} height={380} styles={Object.fromEntries(net.roads.map((r) => [r.key, { color: FLOW_COLORS[flows[r.key].kind], label: net.roads.length > 60 ? (flows[r.key].value ?? flows[r.key].text) : flows[r.key].text }]))} />
          <Legend />
          <div className="max-h-96 overflow-auto"><table className="w-full text-sm" data-testid="final-table"><thead><tr className="text-left text-xs text-slate-500"><th>Road</th><th>Direction</th><th>Flow</th><th>How obtained</th></tr></thead><tbody>
            {net.roads.map((r) => <tr key={r.key} className="border-t border-slate-100 dark:border-navy-700"><td className="py-0.5 pr-2">{r.label || "Unnamed road"}</td><td className="pr-2">{name(r.source)} → {name(r.target)}</td>
              <td className="pr-2 font-mono font-semibold" style={{ color: FLOW_COLORS[flows[r.key].kind] }}>{flows[r.key].text}</td><td className="text-xs">{FLOW_LABELS[flows[r.key].kind]}</td></tr>)}
          </tbody></table></div>
        </div>
      ))}
    </div>
  );
}

export function Legend({ kinds = ["known", "determined", "parametric", "free", "negative", "unresolved"] as FlowKind[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" data-testid="legend">
      {kinds.map((k) => <span key={k} className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded" style={{ background: FLOW_COLORS[k] }} />{FLOW_LABELS[k]}</span>)}
    </div>
  );
}
