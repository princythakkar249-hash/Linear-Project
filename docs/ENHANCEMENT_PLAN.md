# FlowMatrix enhancement: inspection and plan

## Inspection of the existing application

**Working and kept:** exact row reduction (`engine/linalg.py`), classification / null space / feasibility /
SymPy cross-check, adjacency-list + BFS analysis, FastAPI + SQLAlchemy persistence (SQLite and PostgreSQL),
PDF report, React Flow canvas, presentation mode, responsive layout.

**Missing or broken against the specification:**
1. No map-based network creation (no geocoding, no road data, no map).
2. Manual editor: junctions only via a toolbar button; no click-to-create, no click-two-nodes-to-connect;
   duplicate roads are not blocked.
3. Validation stops at the first error; no report of isolated / disconnected / unbalanced parts.
4. Analysis is spread over separate Solver, Graph and Reports pages.
5. Saved solutions are not invalidated when a network is edited, so "solved" counts can be stale.
6. Row-operation steps store a full matrix snapshot each; too heavy for real road networks.
7. Dashboard shows more than requested; no creation method or solution status.
8. Sign convention differs from the specification.
9. Team Contribution content is present in the app, slides and docs.
10. No PowerPoint file exists for this project.

## Decisions (confirmed with the owner)
* Convention: **incoming - outgoing = D**, D = net external demand (+ vehicles leave the network at the
  junction, - vehicles enter). Stored values are migrated by sign flip.
* A new `.pptx` is generated from real screenshots.

## Design
* One graph model (junctions, roads) for both creation methods; one `/api/analyze` pipeline.
* Geocoding: Photon (public Nominatim forbids autocomplete). Routing: OSRM. Road data: Overpass with mirrors.
  All proxied by the backend with identification, throttling and caching.
* Map: Leaflet + OpenStreetMap tiles. Manual canvas: React Flow.
* One workspace page per network; dashboard with three statistics.

## Phases
1. Inspection (this file)  2. Graph model + migration  3. Manual editor  4. OSM extraction  5. Normalisation
6. Shared solver  7. Unified workspace  8. Dashboard / persistence  9. Testing  10. Documentation
11. PowerPoint  12. End-to-end runs of both workflows.

## Completion record

| Phase | Outcome |
|---|---|
| 2 Graph model | one model for both methods; version-1 databases upgraded in place (checked on PostgreSQL with real old rows) |
| 3 Manual editor | click to create, click two junctions or drag to connect, duplicate and self-loop blocking, delete key |
| 4-5 Map creation | Photon + OSRM + Overpass, corridor clipping, junction consolidation (20 m), one-way rules |
| 6-7 Solver and page | one pipeline; 15 sections on the workspace page |
| 8 Dashboard | three statistics from the database; stale solutions invalidated |
| 9 Testing | pytest 59, vitest 16, e2e/workflows.mjs 50 checks, e2e/buttons.mjs 41 checks |
| 10-11 Docs and PPT | 28 documentation sections with real screenshots; presentation/FlowMatrix.pptx, 21 slides |

## Remaining issues
- Deployed to Render and checked live; free services sleep when idle and the free database expires after 30 days.
- Public Overpass servers are slow or unavailable at times (observed 34 s responses and total timeouts).
- Where junctions are closer than the marker size at the current zoom, markers overlap until the user zooms in.
- Demand at the edges of a map extract is not available from map data and must be entered by the user.
- No authentication.
