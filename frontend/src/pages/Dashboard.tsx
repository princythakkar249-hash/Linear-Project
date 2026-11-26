import { CheckCircle2, GitBranch, Map as MapIcon, PenTool, Plus, Trash2, Waypoints, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Card, CardContent, PageHeader } from "@/components/ui/ui";
import { api } from "@/lib/api";
import { readDraft, storeDraft } from "@/lib/useWorkspace";
import type { Dashboard as D, NetworkSummary } from "@/lib/types";
import { STATE_BADGE } from "./Workspace";

function Stat({ icon: Icon, label, value }: { icon: typeof Waypoints; label: string; value: number }) {
  return (
    <Card><CardContent className="flex items-center gap-4 pt-5">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon size={22} /></div>
      <div><div className="text-3xl font-bold" data-testid={`stat-${label}`}>{value}</div><div className="text-sm text-slate-500">{label}</div></div>
    </CardContent></Card>
  );
}

export function CreateDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const manual = () => {
    if (readDraft()?.junctions.length && !confirm("Discard your unsaved network and start a blank one?")) return;
    storeDraft(null);
    navigate("/network/new?method=manual");
  };
  const choice = "flex flex-col items-start gap-2 rounded-2xl border-2 border-slate-200 p-5 text-left transition hover:border-brand-500 hover:bg-brand-50 dark:border-navy-700 dark:hover:bg-navy-800";
  return (
    <div className="fixed inset-0 z-[1200] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Create New Network" className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Create New Network</h2>
          <Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}><X size={18} /></Button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button autoFocus className={choice} onClick={() => navigate("/create/map")}><MapIcon className="text-brand-700" size={28} /><span className="font-semibold">Automatic Map-Based Network</span>
            <span className="text-sm text-slate-500">Pick two places; real roads come from OpenStreetMap.</span></button>
          <button className={choice} onClick={manual}><PenTool className="text-brand-700" size={28} /><span className="font-semibold">Manual Network Creation</span>
            <span className="text-sm text-slate-500">Draw junctions and roads on a blank canvas.</span></button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const draft = readDraft();
  const refresh = useCallback(() => api.dashboard().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)), []);
  useEffect(() => { refresh(); }, [refresh]);

  const remove = async (n: NetworkSummary) => {
    if (!confirm(`Delete “${n.name}” and its stored solutions?`)) return;
    try { await api.deleteNetwork(n.id); await refresh(); } catch (e: any) { setError(e.message); }
  };

  return (
    <>
      <PageHeader title="Dashboard" actions={<Button size="lg" onClick={() => setCreating(true)}><Plus size={18} />Create New Network</Button>} />
      {creating && <CreateDialog onClose={() => setCreating(false)} />}
      {error && <Alert tone="error">{error} <button className="underline" onClick={refresh}>Retry</button></Alert>}
      {!data && !error && <p className="text-slate-500">Loading…</p>}
      {draft && draft.junctions.length > 0 && <div className="mb-4"><Alert tone="warn">You have an unsaved network “{draft.name}”.{" "}
        <button className="font-semibold underline" onClick={() => navigate("/network/new")}>Continue editing</button></Alert></div>}
      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat icon={Waypoints} label="Total Networks" value={data.total_networks} />
            <Stat icon={GitBranch} label="Total Junctions" value={data.total_junctions} />
            <Stat icon={CheckCircle2} label="Solved Networks" value={data.solved_networks} />
          </div>
          <section aria-labelledby="saved">
            <h2 id="saved" className="mb-3 text-lg font-semibold">Saved networks</h2>
            {data.networks.length === 0 ? (
              <Card><CardContent className="pt-5 text-center text-slate-500">No networks yet. Use <b>Create New Network</b> to begin.</CardContent></Card>
            ) : (
              <ul className="space-y-3">
                {data.networks.map((n) => (
                  <li key={n.id} data-testid="network-row">
                    <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
                      <div className="min-w-0 flex-1 basis-64">
                        <div className="truncate font-semibold">{n.name}</div>
                        <div className="text-xs text-slate-500">Created {new Date(n.created_at).toLocaleDateString()} · {n.method === "map" ? "Automatic (map)" : "Manual"}{n.is_demo && " · demo"}</div>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">{n.junctions} junctions · {n.roads} roads</div>
                      <div className="w-36"><Badge tone={STATE_BADGE[n.status.state].tone}>{STATE_BADGE[n.status.state].label}</Badge></div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => navigate(`/network/${n.id}`)}>Open</Button>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/network/${n.id}?edit=1`)}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(n)} aria-label={`Delete ${n.name}`}><Trash2 size={14} />Delete</Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
