import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { emptyNetwork, variableNames } from "./graph";
import type { Analysis, NetworkDraft, Validation } from "./types";

export const DRAFT_KEY = "flowmatrix.draft";

export function storeDraft(n: NetworkDraft | null) {
  try {
    if (n) localStorage.setItem(DRAFT_KEY, JSON.stringify(n));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* storage unavailable: the draft simply is not kept across reloads */ }
}
export function readDraft(): NetworkDraft | null {
  try { const s = localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}

/** State of ONE network being viewed/edited. `id === null` means a not-yet-saved draft. */
export function useWorkspace(id: number | null) {
  const [net, setNetState] = useState<NetworkDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [params, setParams] = useState<Record<string, string>>({});
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState("");
  const loadedId = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    if (id !== null && loadedId.current === id) return; // just saved: keep what is on screen
    loadedId.current = id;
    setLoadError(null); setAnalysis(null); setValidation(null); setParams({}); setStart("");
    if (id === null) { const draft = readDraft() ?? emptyNetwork(); setNetState(draft); setDirty(true); return; }
    setNetState(null); setDirty(false);
    api.getNetwork(id).then(setNetState).catch((e) => setLoadError(e.message));
  }, [id]);

  /** Apply an edit. The graph, equations and labels follow from this single state. */
  const setNet = useCallback((next: NetworkDraft) => {
    // If the unknown roads change, x1, x2, ... are renumbered, so earlier parameter values no longer apply.
    if (net && JSON.stringify(variableNames(net)) !== JSON.stringify(variableNames(next))) setParams({});
    setNetState(next); setDirty(true);
  }, [net]);

  useEffect(() => { if (net && !net.id) storeDraft(net); }, [net]);

  // Re-run the shared solver whenever the network or the parameter values change (debounced, latest wins).
  useEffect(() => {
    if (!net || net.junctions.length === 0) { setAnalysis(null); setValidation(null); setAnalysisError(null); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const out = await api.analyze(net, params, start, controller.signal);
        setValidation(out.validation); setAnalysis(out.result); setAnalysisError(null);
      } catch (e: any) {
        if (e.name === "AbortError") return;
        setAnalysisError(e.message); setAnalysis(null);
      }
      setLoading(false);
    }, 350);
    return () => { clearTimeout(handle); controller.abort(); };
  }, [net, params, start]);

  const save = useCallback(async (): Promise<NetworkDraft> => {
    if (!net) throw new Error("Nothing to save");
    // Demo networks are read-only on the server: saving one stores an independent copy.
    const toSave = net.is_demo ? { ...net, id: undefined, is_demo: false, name: `${net.name} (copy)` } : net;
    const saved = await api.saveNetwork(toSave);
    if (!net.id) storeDraft(null);
    loadedId.current = saved.id!;
    setNetState(saved); setDirty(false);
    return saved;
  }, [net]);

  /** Re-read the stored network (e.g. its solution status). Pass the id right after the first save. */
  const reload = useCallback(async (which = net?.id) => { if (which) setNetState(await api.getNetwork(which)); }, [net?.id]);

  return { net, setNet, loadError, dirty, params, setParams, analysis, validation, analysisError, loading, start, setStart, save, reload };
}
export type Workspace = ReturnType<typeof useWorkspace>;
