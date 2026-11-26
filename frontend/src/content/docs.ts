export interface DocSection { title: string; body: string[]; images?: { src: string; caption: string }[] }

const shot = (file: string, caption: string) => ({ src: `/screenshots/${file}.png`, caption });

export const DOCS: DocSection[] = [
  { title: "Abstract", body: [
    "FlowMatrix (Traffic Flow Network Analyzer) estimates unknown vehicle flows on the roads of a directed network. A network is created either automatically from real OpenStreetMap road data between two places, or by drawing it by hand. Each junction yields a flow-conservation equation, giving a linear system AX = B that is solved by hand-written Gaussian and Gauss-Jordan elimination in exact rational arithmetic. The application classifies the system, finds free variables and the null space (circulating traffic), checks that flows can be nonnegative, analyses connectivity, stores networks and solutions in a database and produces PDF reports.",
  ] },
  { title: "Introduction", body: [
    "Cities measure traffic on only some roads. Because vehicles are neither created nor destroyed at a junction, the unmeasured flows are linked to the measured ones. The same mathematics applies to water, electricity, pipeline and packet networks.",
  ] },
  { title: "Problem statement", body: [
    "Given junctions with a net external demand D, one-way road segments, and measured flows on some of them, find every flow assignment on the remaining roads such that at each junction: incoming − outgoing = D. Decide whether a solution exists, whether it is unique, and whether it is physically possible (no negative flow).",
  ] },
  { title: "Objectives", body: [
    "Create networks from real map data or by hand, using one common graph model.",
    "Generate the conservation equations and the matrices A, B and [A|B] automatically.",
    "Show every row operation, REF, RREF, rank, pivot and free variables.",
    "Give the general solution and null-space basis, and separate mathematically valid from physically feasible flows.",
    "Persist networks and solutions, and export a report.",
  ] },
  { title: "Existing system", body: [
    "Equations are written by hand from a sketch and eliminated manually or in a spreadsheet. This is slow and error-prone, does not scale beyond a few junctions, keeps no record of the steps, and the sketch is disconnected from the real road layout.",
  ] },
  { title: "Proposed system", body: [
    "A web application in which the road network is taken from OpenStreetMap or drawn interactively, the equations follow automatically from the graph, one exact solver serves both creation methods, and the results are written back onto the roads of the same map or drawing.",
  ] },
  { title: "Technology stack", body: [
    "Frontend: React 18, TypeScript, Vite, Tailwind CSS, React Flow (manual canvas), Leaflet with react-leaflet (map), Recharts, Lucide icons.",
    "Backend: Python, FastAPI, Pydantic, SQLAlchemy 2, SciPy (feasibility linear programs), SymPy (independent verification), ReportLab (PDF), HTTPX.",
    "Data and services: PostgreSQL (SQLite for local development); OpenStreetMap tiles, Photon geocoding, OSRM routing, Overpass road data. Testing: Pytest, Vitest, Playwright.",
  ] },
  { title: "System architecture", body: [
    "Browser (React) ⇄ REST/JSON ⇄ FastAPI ⇄ SQLAlchemy ⇄ PostgreSQL. The backend contains: the mathematical engine (equations, row reduction, solution analysis), graph algorithms, the map service (geocoding, routing, road-data conversion), persistence, and the report generator. All mathematics runs on the server, so the screen, the PDF and the database always agree.",
  ], images: [shot("dashboard", "Dashboard: three statistics read from the database and the saved networks.")] },
  { title: "Automatic network generation workflow", body: [
    "1. The user searches for a pickup and a destination (autocomplete) or picks them on the map. 2. OSRM returns a driving route. 3. Overpass returns the real roads within a corridor around that route. 4. The server converts them to junctions and directed roads. 5. The unsaved network opens in the workspace for editing, flow entry, analysis and saving.",
    "Limits: the two places must be 80 m to 6 km apart and the result at most 300 directed roads. Missing route, missing road data, rate limiting and server failures are reported with a retry option.",
  ], images: [shot("map-search", "Selecting pickup and destination with suggestions."), shot("map-network", "A generated network on the real map, with direction arrows and flow labels.")] },
  { title: "Manual network creation workflow", body: [
    "The workspace starts empty. 'Add junction' creates a junction where the user clicks; 'Connect roads' joins two clicked junctions (dragging from a junction's blue dot also works). Junctions can be dragged, renamed, given a demand D and deleted (with their roads). Roads can be named, given different start and end junctions, reversed (one-way roads), made two-way, given a measured flow or marked unknown, and deleted. Self-loops are blocked; a second road in the same direction is blocked unless 'parallel roads' is enabled.",
  ], images: [shot("manual-editor", "Manual canvas with properties panel.")] },
  { title: "OpenStreetMap integration", body: [
    "Tiles come from tile.openstreetmap.org with attribution and normal browser caching. Address autocomplete uses Photon, because the public Nominatim server does not allow autocomplete. Requests to Photon, OSRM and Overpass are made by the backend with an identifying User-Agent, spaced out in time, and cached (road data and routes for 7 days). Several Overpass servers are tried in turn.",
    "Conversion: drivable ways of the chosen classes are clipped to the corridor; dead-end side streets leading away from it are optionally removed (and the number removed is reported); a point becomes a junction if it is an intersection, a dead end, a change of one-way rule, or the pickup or destination; every other point is kept as road geometry. Points within 20 m of each other along a road (the pieces of one physical intersection) are merged into one junction, with a short connector drawn to it. A two-way street becomes two directed edges; oneway=yes, oneway=-1, motorways and roundabouts are respected. Road pieces connected to neither pickup nor destination are left out. The number of merged points and left-out pieces is reported to the user; if pickup and destination are in different parts, both parts are kept and identified.",
  ] },
  { title: "Graph representation", body: [
    "Junction: id, name, canvas position, latitude, longitude, type (pickup, destination, intersection, dead end, junction), net external demand D. Road: id, source id, destination id, name, geometry, direction (source → destination), length, measured flow or unknown, OpenStreetMap way id. Both creation methods produce exactly this model.",
    "Adjacency lists give O(V + E) storage. Breadth-first search provides directed reachability (follow arrows) and weak connectivity (ignore arrows); strongly connected components are found from forward and backward searches.",
  ] },
  { title: "Mathematical methodology", body: [
    "At junction j: Σ incoming − Σ outgoing = D_j, where D_j is the net number of vehicles leaving the modelled network at j (negative when vehicles enter). This is the same as 'vehicles arriving = vehicles departing'.",
    "Summing all equations of a connected part cancels every road, so its demands must add to zero, and rank(A) ≤ junctions − connected parts.",
  ] },
  { title: "Equation generation", body: [
    "Unknown roads are numbered x1, x2, … in road order. For each junction, unknown incoming roads get coefficient +1 and unknown outgoing roads −1; measured flows are moved to the right-hand side: (unknown in) − (unknown out) = D − (known in) + (known out). The interface shows this derivation for every junction.",
  ], images: [shot("equations", "Generated conservation equations.")] },
  { title: "Matrix formation", body: [
    "A has one row per junction and one column per unknown road with entries −1, 0, +1; X is the vector of unknowns in the same order; B holds the constants. [A|B] is the augmented matrix. The same variable order is used on screen, on the map and in the report.",
  ], images: [shot("augmented", "Augmented matrix [A|B].")] },
  { title: "Row reduction", body: [
    "Gaussian elimination takes the first non-zero entry of each column as pivot (exact arithmetic needs no numerical pivoting), swaps rows if required and clears the entries below, producing REF. Gauss-Jordan elimination then scales pivots to 1 and clears above, producing RREF. Every operation is recorded (for example R2 → R2 + R1) and each intermediate matrix can be viewed.",
  ], images: [shot("row-reduction", "Stepping through row operations.")] },
  { title: "Rank and free variables", body: [
    "rank(A) is the number of pivots. If a row reads 0 = c with c ≠ 0 the system is inconsistent. Otherwise it has a unique solution when rank = number of unknowns and infinitely many when rank is smaller; the columns without pivots are free variables, and each pivot variable is written in terms of the parameters t1, t2, ….",
    "A solution is physically feasible only if every flow is ≥ 0. A linear program decides whether any nonnegative choice exists and gives each flow's range (up to 160 unknowns). Negative values are shown, never replaced by zero.",
  ], images: [shot("general-solution", "General solution with nonnegativity constraints.")] },
  { title: "Null space", body: [
    "The null space {v : Av = 0} is computed from the RREF: for each free variable set it to 1, the other free variables to 0, and read the pivot entries with the sign reversed. Each basis vector is a circulation: adding it to a solution keeps every junction balanced. The interface draws each one on the network.",
  ], images: [shot("null-space", "A null-space basis vector shown as circulating traffic.")] },
  { title: "Database schema", body: [
    "users(id, username, created_at); networks(id, user_id, name, description, is_demo, method, map_meta, created_at, updated_at); junctions(id, network_id, key, name, x, y, lat, lng, node_type, net_demand); roads(id, network_id, key, label, source_id, target_id, position, length_m, geometry, osm_way_id, highway, origin); observed_flows(id, road_id, value, measured_at); solutions(id, network_id, created_at, classification, rank, n_equations, n_unknowns, free_variables, parameters, result, stale).",
    "Constraints: unique key per network, no self-loop roads, measured flow ≥ 0, cascading deletes. Saving a network is one transaction. A change that affects the equations marks stored solutions as outdated. Databases from the first version are upgraded in place.",
  ] },
  { title: "API architecture", body: [
    "GET /api/dashboard · GET/POST /api/networks · GET/PUT/DELETE /api/networks/{id} · GET/POST /api/networks/{id}/solutions · POST /api/analyze (validation, then the shared solver) · POST /api/report (PDF) · GET /api/geocode · GET /api/geocode/reverse · POST /api/map/network · GET /api/health. Interactive API documentation is served at /docs by FastAPI.",
  ] },
  { title: "Implementation", body: [
    "backend/app/engine (equations, linalg, solution, validation, pipeline); backend/app/graph; backend/app/services (osm, osm_graph, repository, report); frontend/src/lib/graph.ts (all edit operations), useWorkspace.ts (one network's state and live analysis); frontend/src/components (ManualCanvas, MapView, Analysis, PropertiesPanel); frontend/src/pages (Dashboard, CreateMap, Workspace).",
    "Demonstration networks are read-only; saving one creates a copy. There is no user authentication.",
  ] },
  { title: "Screenshots of the actual application", body: [
    "The images below and in the sections above were captured from the running application by an automated browser script.",
  ], images: [shot("final-network", "Final traffic network with calculated flows."), shot("map-analysis", "The analysis of a map network on the same page.")] },
  { title: "Testing and validation", body: [
    "Backend tests (Pytest) cover equation and matrix generation, replay of every row operation, unique, infinite and inconsistent systems, null-space vectors (Av = 0), sample solutions (AX = B), feasibility, the validation report, the OpenStreetMap conversion (a hand-made street grid and recorded real data), the API, cascading deletes, outdated solutions, PDF generation and the database upgrade.",
    "Frontend tests (Vitest) cover the graph editing operations and flow labelling. Browser tests (Playwright) run both creation workflows end to end. Each solution is also checked at run time: AX = B, Av = 0, rank + nullity, back substitution and a SymPy comparison.",
  ] },
  { title: "Results", body: [
    "Demonstration network 1 (3 junctions, 3 roads): unique solution x1 = 60, x2 = 30. Network 2 (3 junctions, 4 roads): x1 = 30 + t1, x2 = 70 − t1, x3 = t1, null vector (1, −1, 1), feasible for 0 ≤ t1 ≤ 70. Network 3 (5 junctions, 7 roads): rank 4 with two free variables.",
    "Map-based generation was exercised on real roads in Ahmedabad; junction and road counts depend on the places, the corridor and the current OpenStreetMap data.",
  ] },
  { title: "Limitations", body: [
    "Static (steady-state) flows only; no capacities, travel times or turn restrictions. External demands at the edge of a map extract are not known from map data and must be entered. Roads are clipped to a corridor, so some real connections lie outside it. The public map services have no availability guarantee and can be slow. Feasibility ranges come from floating-point linear programs. No authentication.",
  ] },
  { title: "Future scope", body: [
    "Import of live sensor feeds, least-squares estimation with noisy measurements, road capacities and min-cost flow, turn restrictions, time-of-day analysis, user accounts and a self-hosted map-data service.",
  ] },
  { title: "Conclusion", body: [
    "FlowMatrix connects Linear Algebra, Graph Theory, a database and real map data: a road network, real or drawn, becomes AX = B, and row reduction, rank and the null space explain which flows are determined and which can circulate.",
  ] },
  { title: "References", body: [
    "G. Strang, Introduction to Linear Algebra, Wellesley-Cambridge Press.", "D. C. Lay, Linear Algebra and Its Applications, Pearson.",
    "T. H. Cormen et al., Introduction to Algorithms, MIT Press (breadth-first search).",
    "OpenStreetMap (openstreetmap.org/copyright) and its tile usage policy; Photon (photon.komoot.io); Project OSRM; Overpass API.",
    "Documentation of FastAPI, SQLAlchemy, SymPy, SciPy, React Flow and Leaflet.",
  ] },
];
