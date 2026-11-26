# FlowMatrix — Traffic Flow Network Analyzer

Estimates unknown road traffic with **Linear Algebra** (conservation equations, Gaussian / Gauss-Jordan elimination, rank, free variables, null space) and **Graph Theory** (adjacency lists, BFS, connectivity). A network is created either **from real OpenStreetMap roads** between two places or **drawn by hand**; both produce the same graph and use the same solver.

## The convention

At every junction

```
incoming flow − outgoing flow = D
```

`D` is the junction's **net external demand**: the net number of vehicles that **leave** the modelled network there (positive = vehicles exit, negative = vehicles enter). Measured flows are moved to the right-hand side; unknown roads become `x1, x2, …`, giving `AX = B`.

## Features

- **Dashboard:** total networks, total junctions, solved networks (all computed from the database), *Create New Network*, and the saved networks with Open / Edit / Delete.
- **Automatic map creation:** address autocomplete for pickup and destination (or click / drag on the map), real roads from OpenStreetMap in a corridor around the driving route, one-way rules preserved, real road geometry.
- **Manual creation:** click to add junctions, click two junctions (or drag) to connect them, edit demands, names, measured flows and direction.
- **One workspace page per network:** the map or canvas on top; below it 15 analysis sections (validation, junctions, equations, A, [A|B], Gaussian elimination, row-operation history, REF/RREF, rank, pivot and free variables, classification, general solution, null space, example solution, final network).
- Flows are written back onto the roads and update when free-variable values change. Negative values are reported, never replaced by zero.
- PDF report, project documentation, viva questions, 21-slide presentation mode, and a PowerPoint in `presentation/`.

## Run locally

Requirements: Python 3.11+, Node 18+, internet access for map features.

```bash
# backend  (http://127.0.0.1:8000, API docs at /docs)
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows  (source .venv/bin/activate elsewhere)
pip install -r requirements.txt
uvicorn app.main:app --reload

# frontend (http://localhost:5173; Vite proxies /api to port 8000)
cd frontend
npm install
npm run dev
```

The first start creates the tables and, on an empty database only, three demonstration networks (read-only; saving one makes a copy). A database created by version 1 is upgraded automatically (`external_inflow` is renamed to `net_demand` with its sign flipped).

### Configuration (all optional)

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL URL. Unset: local SQLite file `traffic.db`. |
| `CORS_ORIGINS` | Allowed browser origins, comma separated. |
| `SEED_DEMOS` | `0` to start with an empty database. |
| `PHOTON_URL`, `OSRM_URL`, `OVERPASS_URLS` | Use your own or alternative map services. |
| `OSM_USER_AGENT` | Identification sent to the map services. Change it if you fork the project. |
| `MAP_MAX_DISTANCE_M` | Longest pickup–destination distance (default 6000). |
| `VITE_API_URL`, `VITE_TILE_URL` | Frontend: backend URL and tile server. |

## Map services and their rules

| Purpose | Service | Notes |
|---|---|---|
| Tiles | tile.openstreetmap.org | attribution shown; normal browser caching; no bulk download |
| Autocomplete | Photon | the public Nominatim server forbids autocomplete, so it is not used |
| Route | OSRM demo server | defines the corridor |
| Road data | Overpass API (several mirrors) | cached 7 days in `backend/.osm_cache` |

These are free community services with no availability guarantee. Overpass in particular can take a minute or fail when busy; the app then says so and offers retry or manual creation. For a live demonstration, generate your example network beforehand (it is then cached and saved).

## Tests

```bash
cd backend  && python -m pytest              # mathematics, map conversion, API, database upgrade
cd frontend && npm test && npm run build     # graph editing + type check + production build
cd frontend && node e2e/workflows.mjs all    # both workflows in a real browser (servers running; A needs internet)
cd frontend && node e2e/buttons.mjs          # the remaining buttons and interactions
```

`TEST_DATABASE_URL=postgresql://…` runs the backend tests against PostgreSQL (its tables are dropped and recreated). The browser script also refreshes the screenshots in `frontend/public/screenshots/`. `python tools/make_ppt.py` (needs `pip install python-pptx Pillow`) rebuilds the PowerPoint from them.

## Layout

```
backend/app/engine      equations, row reduction, solution analysis, validation, pipeline
backend/app/graph       adjacency lists, BFS, connectivity
backend/app/services    osm.py (map services), osm_graph.py (OSM -> graph), repository, report
backend/app             models, migrations, schemas, routers
frontend/src/lib        graph.ts (every edit operation), useWorkspace.ts
frontend/src/components ManualCanvas, MapView, Analysis, PropertiesPanel
frontend/src/pages      Dashboard, CreateMap, Workspace, Documentation, PresentationMode, Settings
frontend/e2e            browser workflows
presentation/           FlowMatrix.pptx        tools/make_ppt.py
```

## Deployment (Render)

`render.yaml` is a Blueprint for PostgreSQL, the API (`tfna-yashvi-api`) and the static frontend (`tfna-yashvi-web`), which forwards `/api/*` to the API. Free services sleep when idle and Render's free PostgreSQL expires after 30 days. Alternative: frontend on Vercel (`frontend/vercel.json`, set `VITE_API_URL` and `CORS_ORIGINS`).

[Deploy to Render](https://render.com/deploy?repo=https://github.com/YashviShah514/traffic-flow-network-analyzer)

## Limitations

- Static flows only: no capacities, travel times or turn restrictions.
- Map data does not know how many vehicles enter or leave at the edge of an extract; those demands must be entered.
- Roads are clipped to a corridor around the route; by default dead-end side streets are left out, points within 20 m are merged into one junction, and pieces connected to neither place are dropped (all reported).
- Map-based generation depends on public services.
- Per-road feasible ranges are floating-point linear programs and are skipped above 160 unknowns.
- No user authentication; all data belongs to one default user.
- The shadcn-style UI components are hand-written.
