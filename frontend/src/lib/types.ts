/** The one graph model used by both creation methods (mirrors backend/app/schemas.py). */
export type Method = "manual" | "map";
export type LatLng = [number, number];

export interface Junction {
  key: string; name: string; x: number; y: number;
  lat?: number | null; lng?: number | null; node_type?: string;
  /** D: net vehicles leaving the network here (+ exit, - enter). incoming - outgoing = D */
  net_demand: string;
}
export interface Road {
  key: string; label: string; source: string; target: string; known_flow: string | null;
  length_m?: number | null; geometry?: LatLng[] | null; osm_way_id?: string | null; highway?: string;
  origin?: "osm" | "user";
}
export interface Place { lat: number; lng: number; label: string; detail?: string }
export interface MapMeta {
  pickup: Place; destination: Place; route?: LatLng[]; route_distance_m?: number; detail?: string;
  radius_m?: number; trip_flow?: number; attribution?: string;
  /** What the generator merged, left out or could not connect (shown in the workspace). */
  notes?: string[];
}
export type State = "not_solved" | "outdated" | "solved" | "inconsistent";
export interface Status { state: State; classification: string | null; rank: number | null }

export interface NetworkDraft {
  id?: number; name: string; description: string; method: Method; map_meta?: MapMeta | null;
  is_demo?: boolean; status?: Status; created_at?: string; updated_at?: string;
  junctions: Junction[]; roads: Road[];
}
export interface NetworkSummary {
  id: number; name: string; description: string; is_demo: boolean; method: Method; junctions: number; roads: number;
  created_at: string; updated_at: string; status: Status;
}
export interface Dashboard {
  total_networks: number; total_junctions: number; solved_networks: number; networks: NetworkSummary[];
}

export interface Issue { code: string; message: string; item: string | null }
export interface Validation {
  ok: boolean; errors: Issue[]; warnings: Issue[];
  counts: { junctions: number; roads: number; components: number };
}
export interface Variable { name: string; road_key: string; source: string; target: string; label: string }
export interface RoadDesc { road_key: string; label: string; from: string; to: string; variable: string | null; known_flow: string | null }
export interface EquationInfo {
  junction_key: string; junction_name: string; text: string; rhs: string; net_demand: string;
  known_in_sum: string; known_out_sum: string; derivation: string[]; coefficients: Record<string, string>;
  incoming: RoadDesc[]; outgoing: RoadDesc[];
}
export interface Step {
  index: number; phase: "forward" | "backward"; kind: "pivot" | "swap" | "scale" | "add";
  description: string; notation: string; changed: Record<string, string[]>; pivot: [number, number] | null;
}
export interface GeneralEntry {
  variable: string; constant: string; terms: { parameter: string; coefficient: string }[];
  is_free: boolean; expression: string; text: string;
}
export interface SolutionInfo {
  parameters: Record<string, string>; values: Record<string, string>;
  roads: { road_key: string; label: string; from: string; to: string; value: string; known: boolean; negative: boolean }[];
  mathematically_valid: boolean; physically_feasible: boolean; negative_variables: string[];
}
export type FlowStatus = "known" | "determined" | "parametric" | "free" | "unresolved";
export interface GraphResult {
  adjacency_out: Record<string, string[]>; adjacency_in: Record<string, string[]>;
  degrees: Record<string, { in: number; out: number }>;
  weak_components: string[][]; weakly_connected: boolean;
  strong_components: string[][]; strongly_connected: boolean;
  isolated_junctions: string[]; sources_only: string[]; sinks_only: string[]; start: string | null; note?: string;
  bfs_directed?: { order: string[]; levels: Record<string, number>; unreachable: string[] };
  bfs_undirected?: { order: string[]; levels: Record<string, number>; unreachable: string[] };
}
export interface Analysis {
  variables: Variable[];
  equations: EquationInfo[];
  matrix: { A: string[][]; B: string[]; augmented: string[][]; variables: string[] };
  reduction: { ref: string[][]; rref: string[][]; steps: Step[] };
  analysis: {
    classification: "unique" | "infinite" | "none"; consistent: boolean; rank: number; independent_equations: number;
    n_unknowns: number; n_equations: number; nullity: number; pivot_columns: number[]; pivot_variables: string[];
    free_variables: string[]; inconsistent_rows: number[]; particular: string[] | null;
    null_basis: { parameter: string; free_variable: string; vector: string[] }[];
    general_solution: GeneralEntry[]; constraints: { variable: string; text: string }[];
  };
  road_status: { road_key: string; variable: string | null; status: FlowStatus; expression: string }[];
  sample_solution: SolutionInfo | null;
  feasible_example: SolutionInfo | null;
  feasibility: { exists: boolean | null; ranges: Record<string, { min: number | null; max: number | null }>; ranges_skipped: boolean };
  circulations: { parameter: string; free_variable: string; roads: { variable: string; road_key: string; coefficient: string }[] }[];
  verification: { all_passed: boolean; sympy: Record<string, boolean>; [k: string]: unknown };
  graph: GraphResult;
  conclusion: string;
}
export interface AnalyzeResponse { validation: Validation; result: Analysis | null }
export interface MapResult {
  network: NetworkDraft; warnings: string[];
  stats: { junctions: number; roads: number; components: number; destination_reachable: boolean; pickup_junction: string; destination_junction: string; pruned_segments: number };
}
