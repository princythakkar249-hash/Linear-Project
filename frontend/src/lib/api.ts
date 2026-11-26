import type { AnalyzeResponse, Dashboard, MapResult, NetworkDraft, Place } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, { headers: { "Content-Type": "application/json" }, ...init });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Cannot reach the backend. Is the FastAPI server running on port 8000?");
  }
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : body.detail?.map((d: any) => `${d.loc?.slice(-1)}: ${d.msg}`).join("; ") ?? msg;
    } catch { /* keep the status text */ }
    throw new ApiError(msg);
  }
  if (res.status === 204) return undefined as T;
  if (res.headers.get("content-type")?.includes("application/pdf")) return (await res.blob()) as T;
  return res.json();
}

const body = (o: unknown) => JSON.stringify(o);
const post = <T,>(path: string, o: unknown, signal?: AbortSignal) => req<T>(path, { method: "POST", body: body(o), signal });

/** Only the fields the server accepts. */
export function payload(n: NetworkDraft) {
  return { name: n.name.trim() || "Untitled network", description: n.description, method: n.method, map_meta: n.map_meta ?? null,
    junctions: n.junctions, roads: n.roads };
}

export const api = {
  health: () => req<{ status: string }>("/api/health"),
  dashboard: () => req<Dashboard>("/api/dashboard"),
  getNetwork: (id: number) => req<NetworkDraft>(`/api/networks/${id}`),
  saveNetwork: (n: NetworkDraft) =>
    n.id ? req<NetworkDraft>(`/api/networks/${n.id}`, { method: "PUT", body: body(payload(n)) })
         : post<NetworkDraft>("/api/networks", payload(n)),
  deleteNetwork: (id: number) => req<void>(`/api/networks/${id}`, { method: "DELETE" }),
  analyze: (n: NetworkDraft, parameters: Record<string, string>, start?: string, signal?: AbortSignal) =>
    post<AnalyzeResponse>("/api/analyze", { network: payload(n), parameters, start_junction: start || null }, signal),
  storeSolution: (id: number, parameters: Record<string, string>) =>
    post<{ id: number; classification: string }>(`/api/networks/${id}/solutions`, { parameters }),
  report: (n: NetworkDraft, parameters: Record<string, string>) => post<Blob>("/api/report", { network: payload(n), parameters }),
  geocode: (q: string, near?: { lat: number; lng: number }, signal?: AbortSignal) =>
    req<Place[]>(`/api/geocode?q=${encodeURIComponent(q)}${near ? `&lat=${near.lat}&lng=${near.lng}` : ""}`, { signal }),
  reverse: (lat: number, lng: number) => req<Place>(`/api/geocode/reverse?lat=${lat}&lng=${lng}`),
  generateMapNetwork: (o: { pickup: Place; destination: Place; detail: string; radius_m: number; prune_stubs: boolean; trip_flow: number }, signal?: AbortSignal) =>
    post<MapResult>("/api/map/network", o, signal),
};
