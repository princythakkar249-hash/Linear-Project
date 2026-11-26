export type Level = "Beginner" | "Intermediate" | "Advanced";
export interface QA { level: Level; q: string; a: string }
export interface Category { name: string; items: QA[] }

export const VIVA: Category[] = [
  { name: "Linear Algebra", items: [
    { level: "Beginner", q: "Why does traffic lead to linear equations?", a: "At every junction incoming − outgoing = D. Sums of flows are linear in the road flows." },
    { level: "Intermediate", q: "What are the three possible outcomes of AX = B?", a: "No solution (rank A < rank [A|B]), a unique solution (rank = number of unknowns), or infinitely many (consistent with rank < unknowns). Network 1 is unique; Networks 2 and 3 are infinite." },
    { level: "Advanced", q: "Why must the demands of a connected network add to zero?", a: "Each road appears once with +1 (where it ends) and once with −1 (where it starts), so adding all equations cancels every flow and leaves 0 = ΣD." },
  ] },
  { name: "Matrix Operations", items: [
    { level: "Beginner", q: "What are A, X and B?", a: "A: one row per junction, one column per unknown road, entries −1/0/+1. X: unknown flows. B: demands adjusted by measured flows." },
    { level: "Intermediate", q: "What is the augmented matrix?", a: "[A|B]; row operations on it do not change the solution set." },
  ] },
  { name: "Gaussian Elimination", items: [
    { level: "Beginner", q: "What are the elementary row operations?", a: "Swap two rows, multiply a row by a non-zero number, add a multiple of one row to another. All are reversible." },
    { level: "Intermediate", q: "Do you need partial pivoting?", a: "Not here: arithmetic is exact (fractions), so there is no rounding error to control; the first non-zero entry is used." },
  ] },
  { name: "RREF", items: [
    { level: "Beginner", q: "How does RREF differ from REF?", a: "In RREF every pivot is 1 and is the only non-zero entry in its column." },
    { level: "Intermediate", q: "Why can RREF be compared with SymPy entry by entry?", a: "The RREF of a matrix is unique." },
  ] },
  { name: "Matrix Rank", items: [
    { level: "Beginner", q: "What is rank?", a: "The number of pivots, i.e. of independent equations. Demo Network 3 has rank 4." },
    { level: "Advanced", q: "State rank–nullity for Network 3.", a: "rank + nullity = unknowns: 4 + 2 = 6." },
  ] },
  { name: "Free Variables", items: [
    { level: "Beginner", q: "What is a free variable?", a: "An unknown whose column has no pivot; it can be chosen, and the pivot variables follow." },
    { level: "Intermediate", q: "General solution of Network 2?", a: "x1 = 30 + t, x2 = 70 − t, x3 = t; physically feasible only for 0 ≤ t ≤ 70." },
  ] },
  { name: "Null Space", items: [
    { level: "Beginner", q: "What is the null space?", a: "All v with Av = 0. For Network 2: multiples of (1, −1, 1)." },
    { level: "Intermediate", q: "What does a null vector mean for traffic?", a: "A circulation: changing flows along it keeps every junction balanced." },
    { level: "Advanced", q: "Why is every solution a particular solution plus a null-space vector?", a: "If Ax = b and Ay = b then A(x − y) = 0; conversely adding a null vector to a solution keeps Ax = b." },
  ] },
  { name: "Graph Theory", items: [
    { level: "Beginner", q: "How is a road network a graph?", a: "Junctions are vertices, one-way road segments are directed edges; a two-way street is two edges." },
    { level: "Intermediate", q: "Weak versus strong connectivity?", a: "Weak ignores directions; strong requires a directed path between every pair. A→B←C is weakly but not strongly connected." },
    { level: "Advanced", q: "How do cycles relate to the null space?", a: "With all roads unknown, the null space is the cycle space of the graph, of dimension E − V + number of components." },
  ] },
  { name: "BFS", items: [
    { level: "Beginner", q: "How does BFS work?", a: "A queue visits all neighbours level by level from a start junction." },
    { level: "Intermediate", q: "Complexity?", a: "O(V + E) with adjacency lists." },
  ] },
  { name: "Maps and OpenStreetMap", items: [
    { level: "Beginner", q: "Where do the roads in automatic mode come from?", a: "OpenStreetMap, downloaded through the Overpass API for a corridor around the driving route." },
    { level: "Intermediate", q: "When does a map point become a junction?", a: "At intersections, dead ends, changes of one-way rule and at pickup/destination; other points only shape the road." },
    { level: "Intermediate", q: "Why not use Nominatim for autocomplete?", a: "The public Nominatim usage policy forbids autocomplete; Photon is designed for search-as-you-type." },
    { level: "Advanced", q: "What can make a generated network infeasible?", a: "Demands at the edge of the extract are unknown to the map; with one-way roads a measured flow may be impossible unless matching demands are entered." },
  ] },
  { name: "Database Management", items: [
    { level: "Beginner", q: "Which tables exist?", a: "users, networks, junctions, roads, observed_flows, solutions." },
    { level: "Intermediate", q: "What happens when a junction is deleted?", a: "Its roads and their measured flows are removed in the same transaction, and stored solutions are marked outdated." },
  ] },
  { name: "Backend", items: [
    { level: "Intermediate", q: "Do the two creation methods use different solvers?", a: "No. Both produce the same junction/road model and call POST /api/analyze." },
    { level: "Advanced", q: "Why fractions rather than floating point?", a: "Round-off can create or hide pivots and change the rank." },
  ] },
  { name: "Frontend", items: [
    { level: "Beginner", q: "Which libraries draw the network?", a: "React Flow for the manual canvas and Leaflet for the map." },
    { level: "Intermediate", q: "How do edges follow a dragged junction?", a: "Edges reference node ids; their geometry is computed from the node objects on every render." },
  ] },
  { name: "Project Architecture", items: [
    { level: "Beginner", q: "Name the layers.", a: "React → FastAPI → engine and map services → SQLAlchemy → PostgreSQL." },
    { level: "Advanced", q: "How do you know results are correct?", a: "Exact AX = B and Av = 0 checks, back substitution, a SymPy comparison, and automated tests." },
  ] },
];
