"""Builds presentation/FlowMatrix.pptx from the real screenshots in frontend/public/screenshots.

    python tools/make_ppt.py

Screenshots are produced by `node e2e/workflows.mjs all` (frontend folder); this script fails if one is missing.
Colours and terms follow the application.
"""
from pathlib import Path

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "frontend" / "public" / "screenshots"
OUT = ROOT / "presentation" / "FlowMatrix.pptx"

NAVY, BLUE, CYAN = RGBColor(0x0B, 0x1F, 0x3A), RGBColor(0x1D, 0x4E, 0xD8), RGBColor(0x08, 0x91, 0xB2)
WHITE, GREY, LIGHT = RGBColor(255, 255, 255), RGBColor(0x47, 0x55, 0x69), RGBColor(0xF1, 0xF5, 0xF9)
FONT, MONO = "Segoe UI", "Consolas"

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
BLANK = prs.slide_layouts[6]
TITLE_ONLY = prs.slide_layouts[5]


def text(slide, x, y, w, h, lines, size=18, color=NAVY, bold=False, font=FONT, align=PP_ALIGN.LEFT, bullet=False,
         anchor=MSO_ANCHOR.TOP):
    frame = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h)).text_frame
    frame.word_wrap = True
    frame.vertical_anchor = anchor
    for i, line in enumerate([lines] if isinstance(lines, str) else lines):
        p = frame.paragraphs[0] if i == 0 else frame.add_paragraph()
        p.alignment = align
        p.space_after = Pt(size * 0.45)
        run = p.add_run()
        run.text = ("▪  " if bullet else "") + line
        run.font.size, run.font.bold, run.font.name = Pt(size), bold, font
        run.font.color.rgb = color
    return frame


def box(slide, x, y, w, h, label, sub="", fill=NAVY, color=WHITE, size=15):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.fill.background()
    shape.shadow.inherit = False
    frame = shape.text_frame
    frame.word_wrap = True
    frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    for i, (value, s, b) in enumerate([(label, size, True)] + ([(sub, size - 3, False)] if sub else [])):
        p = frame.paragraphs[0] if i == 0 else frame.add_paragraph()
        p.alignment = PP_ALIGN.CENTER
        run = p.add_run()
        run.text = value
        run.font.size, run.font.bold, run.font.name = Pt(s), b, FONT
        run.font.color.rgb = color


def arrow(slide, x, y, w=0.4):
    shape = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x), Inches(y), Inches(w), Inches(0.28))
    shape.fill.solid()
    shape.fill.fore_color.rgb = CYAN
    shape.line.fill.background()


def picture(slide, name, x, y, w, h):
    path = SHOTS / f"{name}.png"
    if not path.exists():
        raise SystemExit(f"Missing screenshot {path}. Run: node e2e/workflows.mjs all")
    with Image.open(path) as im:
        ratio = im.width / im.height
    width, height = (w, w / ratio) if w / ratio <= h else (h * ratio, h)
    pic = slide.shapes.add_picture(str(path), Inches(x + (w - width) / 2), Inches(y + (h - height) / 2), Inches(width), Inches(height))
    pic.line.color.rgb = RGBColor(0xCB, 0xD5, 0xE1)
    pic.name = f"screenshot: {name}"


def slide(title, kicker, notes):
    s = prs.slides.add_slide(TITLE_ONLY)
    holder = s.shapes.title  # real title placeholder: outline view and accessibility work
    holder.left, holder.top, holder.width, holder.height = Inches(0.6), Inches(0.55), Inches(12.1), Inches(0.8)
    holder.text_frame.text = title
    p = holder.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    p.font.size, p.font.bold, p.font.name, p.font.color.rgb = Pt(30), True, FONT, NAVY
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(0.12))
    bar.fill.solid()
    bar.fill.fore_color.rgb = BLUE
    bar.line.fill.background()
    text(s, 0.6, 0.25, 6, 0.35, kicker.upper(), 12, CYAN, True)
    text(s, 11.9, 7.0, 1.2, 0.35, str(len(prs.slides)), 11, GREY, align=PP_ALIGN.RIGHT)
    text(s, 0.6, 7.0, 6, 0.35, "FlowMatrix · Traffic Flow Network Analyzer", 11, GREY)
    s.notes_slide.notes_text_frame.text = notes
    return s


def bullets(s, items, x=0.6, y=1.7, w=12, size=22):
    text(s, x, y, w, 5, items, size, NAVY, bullet=True)


def shot_slide(title, kicker, notes, image, points):
    s = slide(title, kicker, notes)
    picture(s, image, 0.5, 1.55, 8.6, 5.3)
    bullets(s, points, 9.35, 1.8, 3.6, 17)


# 1. Title
s = prs.slides.add_slide(BLANK)
s.background.fill.solid()
s.background.fill.fore_color.rgb = NAVY
text(s, 0.8, 1.9, 11.7, 0.5, "LINEAR ALGEBRA · GRAPH THEORY · DBMS", 16, CYAN, True, align=PP_ALIGN.CENTER)
text(s, 0.8, 2.6, 11.7, 1.3, "FlowMatrix", 66, WHITE, True, align=PP_ALIGN.CENTER)
text(s, 0.8, 4.0, 11.7, 0.6, "Traffic Flow Network Analyzer", 28, WHITE, align=PP_ALIGN.CENTER)
text(s, 0.8, 5.0, 11.7, 0.8, "Estimating unknown road traffic with conservation equations, row reduction and the null space", 17,
     RGBColor(0x94, 0xA3, 0xB8), align=PP_ALIGN.CENTER)
s.notes_slide.notes_text_frame.text = "FlowMatrix turns a real or hand-drawn road network into linear equations and works out the unmeasured traffic."

s = slide("Introduction", "Introduction", "Only some roads carry sensors. Conservation at junctions links the rest.")
bullets(s, ["Traffic sensors exist on only some roads", "Vehicles are neither created nor destroyed at a junction",
            "So every junction gives one linear equation", "Solving the system estimates the missing flows",
            "The same idea applies to water, power and data networks"])

s = slide("Problem statement", "Problem", "State inputs and questions precisely, then show the one equation behind everything.")
bullets(s, ["Given: junctions, one-way road segments, net external demand D, some measured flows",
            "Find: every flow assignment on the unmeasured roads", "Is there a solution, and is it unique?",
            "Is it physically possible, with no negative flow?"], size=21)
box(s, 2.4, 5.3, 8.5, 1.0, "incoming flow − outgoing flow = D     ⇒     AX = B", fill=NAVY, size=24)

s = slide("Objectives", "Objectives", "Each objective corresponds to something shown in the demonstration.")
bullets(s, ["Create networks from real map data or by hand", "One common graph model and one solver", "Generate equations and matrices automatically",
            "Show every row operation"], w=6, size=20)
bullets(s, ["Rank, free variables and null space", "Separate mathematical from physical solutions", "Draw results back on the roads",
            "Save to a database and export reports"], x=6.8, w=6, size=20)

s = slide("Proposed solution", "Proposed system", "Contrast with working by hand.")
box(s, 0.6, 1.7, 5.9, 0.7, "Existing: by hand", fill=RGBColor(0x99, 0x1B, 0x1B), size=18)
bullets(s, ["Sketch junctions", "Write equations manually", "Eliminate on paper or in a spreadsheet", "Sketch is detached from real roads"], y=2.7, w=5.9, size=18)
box(s, 6.8, 1.7, 5.9, 0.7, "Proposed: FlowMatrix", fill=RGBColor(0x06, 0x5F, 0x46), size=18)
bullets(s, ["Real OpenStreetMap roads, or draw them", "Equations generated from the graph", "Exact, step-by-step, verified reduction", "Flows written back onto the network"], x=6.8, y=2.7, w=5.9, size=18)

s = slide("System architecture", "Architecture", "Both creation methods meet at the common graph model before the solver.")
box(s, 0.4, 2.2, 2.0, 0.9, "Map creation", fill=BLUE)
box(s, 0.4, 3.5, 2.0, 0.9, "Manual canvas", fill=BLUE)
arrow(s, 2.5, 3.15)
box(s, 3.0, 2.6, 2.0, 1.4, "Common graph", "junctions · roads")
arrow(s, 5.1, 3.15)
box(s, 5.6, 2.6, 1.9, 1.4, "FastAPI", "validation")
arrow(s, 7.6, 3.15)
box(s, 8.1, 1.8, 2.5, 0.85, "Linear-algebra engine", fill=CYAN)
box(s, 8.1, 2.85, 2.5, 0.85, "Graph / BFS", fill=CYAN)
box(s, 8.1, 3.9, 2.5, 0.85, "PDF report", fill=CYAN)
arrow(s, 10.7, 3.15)
box(s, 11.2, 2.6, 1.8, 1.4, "PostgreSQL", "SQLAlchemy")
box(s, 0.4, 5.3, 12.6, 0.8, "Map service (backend): Photon search → OSRM route → Overpass road data", fill=LIGHT, color=NAVY)

s = slide("Technology stack", "Technology", "SymPy is used only to verify the hand-written elimination.")
for i, (head, items) in enumerate([
        ("Frontend", "React · TypeScript · Vite\nTailwind CSS · React Flow\nLeaflet · Recharts"),
        ("Backend", "Python · FastAPI · Pydantic\nSQLAlchemy · SciPy · SymPy\nReportLab · HTTPX"),
        ("Data and services", "PostgreSQL · OpenStreetMap\nPhoton · OSRM · Overpass\nPytest · Vitest · Playwright")]):
    box(s, 0.6 + i * 4.15, 1.9, 3.9, 0.8, head, fill=BLUE, size=19)
    box(s, 0.6 + i * 4.15, 2.85, 3.9, 2.6, items, fill=LIGHT, color=NAVY, size=17)

shot_slide("Automatic map-based network creation", "Method 1", "Point out real street names and one-way arrows.", "map-network",
           ["Search pickup and destination", "Real roads in a corridor around the route", "Intersections become junctions", "One-way rules preserved", "Edit, add flows, analyse, save"])
shot_slide("Manual network creation", "Method 2", "Click to create junctions, connect two, edit in the side panel.", "manual-editor",
           ["Click the canvas to add junctions", "Connect two junctions to add a road", "Edges follow their junctions", "Set demand D and measured flows", "Same solver as map mode"])
shot_slide("OpenStreetMap integration", "Map data", "Public Nominatim forbids autocomplete, so Photon is used. Requests are identified, spaced and cached.", "map-search",
           ["Autocomplete by Photon", "Driving route by OSRM", "Road data by Overpass", "Tiles with attribution", "Caching, rate limiting, clear errors"])

s = slide("Graph representation", "Graph theory", "Junctions are vertices, roads directed edges. Explain BFS for reachability and connectivity.")
bullets(s, ["Junction = vertex: id, name, coordinates, type, demand D", "Road = directed edge: source, destination, name, geometry, length, flow",
            "A two-way street is two directed edges", "Adjacency lists use O(V + E) memory", "BFS: directed reachability and weak connectivity",
            "Disconnected parts are identified, not hidden"], size=20)

shot_slide("Mathematical equation generation", "Mathematics", "Read one equation and show where the measured flow moved.", "equations",
           ["One equation per junction", "Incoming − outgoing = D", "Unknown roads are x1, x2, …", "Measured flows move to the right side", "Each derivation can be inspected"])
shot_slide("Matrix formation", "AX = B", "Rows are junctions; columns are unknown roads in a fixed order.", "augmented",
           ["Rows: junctions", "Columns: unknown roads", "Entries −1, 0, +1", "[A|B] appends the constants", "Same variable order everywhere"])
shot_slide("Gaussian elimination and RREF", "Row reduction", "Step through the operations; REF first, then Gauss-Jordan.", "row-reduction",
           ["Gaussian: zeros below pivots (REF)", "Gauss-Jordan: pivots 1, zeros above (RREF)", "Every operation recorded", "Exact fraction arithmetic", "rank = number of pivots"])

s = slide("Free variables and null space", "Solution structure", "A null vector is circulating traffic: every junction stays balanced.")
picture(s, "general-solution", 0.4, 1.6, 6.3, 3.9)
picture(s, "null-space", 6.9, 1.6, 6.0, 3.9)
text(s, 0.6, 5.8, 12.1, 1.0, ["Columns without a pivot are free variables; the others are written in terms of t1, t2, …",
                              "Null-space vectors satisfy A·v = 0: circulations that keep every junction balanced"], 17, bullet=True)

shot_slide("Live traffic flow visualization", "Results on the network", "Change a parameter live and show the labels update.", "final-network",
           ["Calculated flows on the correct roads", "Measured, calculated and free flows coloured differently", "Negative flows flagged, never hidden", "Labels follow parameter changes"])

s = slide("Database design", "DBMS", "A road is known exactly when it has an observed_flows row.")
tables = [("users", "id, username"), ("networks", "id, user_id, name, method, map_meta, timestamps"), ("junctions", "id, network_id, lat, lng, node_type, net_demand"),
          ("roads", "id, network_id, source_id, target_id, geometry, length"), ("observed_flows", "id, road_id, value ≥ 0, measured_at"), ("solutions", "id, network_id, classification, rank, stale")]
for i, (name, cols) in enumerate(tables):
    box(s, 0.6 + (i % 3) * 4.15, 1.8 + (i // 3) * 1.65, 3.9, 1.4, name, cols, size=19)
text(s, 0.6, 5.4, 12.1, 1.0, ["Cascading deletes · one transaction per save · edits mark old solutions outdated"], 17, GREY)

s = slide("Application demonstration", "Demonstration", "Switch to the live application: run workflow A, then workflow B.")
picture(s, "dashboard", 0.4, 1.6, 6.3, 4.2)
picture(s, "map-analysis", 6.9, 1.6, 6.0, 4.2)
text(s, 0.6, 6.0, 12.1, 0.8, ["Workflow A: two places → real network → edit → flows → analysis → save",
                              "Workflow B: draw → flows → RREF → change parameters → save"], 16, bullet=True)

s = slide("Testing and results", "Quality", "Counts are from the final test run of this version.")
RESULTS = [("Check", "Result"), ("Backend tests (Pytest), SQLite and PostgreSQL", "59 passed"), ("Frontend tests (Vitest)", "16 passed"),
           ("Browser workflows A (map) and B (manual)", "all checks passed"), ("Demo network 1", "unique: x1 = 60, x2 = 30"),
           ("Demo network 2", "x1 = 30 + t, x2 = 70 − t, x3 = t"), ("Demo network 3", "rank 4, two free variables")]
table = s.shapes.add_table(len(RESULTS), 2, Inches(0.8), Inches(1.8), Inches(11.7), Inches(4.2)).table
table.columns[0].width, table.columns[1].width = Emu(Inches(6.6)), Emu(Inches(5.1))
for r, row in enumerate(RESULTS):
    for c, value in enumerate(row):
        cell = table.cell(r, c)
        cell.text = value
        p = cell.text_frame.paragraphs[0]
        p.font.size, p.font.name = Pt(17), FONT
        p.font.color.rgb = WHITE if r == 0 else NAVY
        cell.fill.solid()
        cell.fill.fore_color.rgb = BLUE if r == 0 else (LIGHT if r % 2 else WHITE)

s = slide("Future scope", "Next steps", "Be honest about what the system does not do.")
box(s, 0.6, 1.7, 5.9, 0.7, "Present limitations", fill=RGBColor(0x92, 0x40, 0x0E), size=18)
bullets(s, ["Static flows; no capacities or turn restrictions", "Edge-of-map demands must be entered", "Public map services can be slow or fail", "No user authentication"], y=2.7, w=5.9, size=18)
box(s, 6.8, 1.7, 5.9, 0.7, "Future scope", fill=RGBColor(0x06, 0x5F, 0x46), size=18)
bullets(s, ["Live sensor feeds", "Least squares for noisy measurements", "Capacities and min-cost flow", "Self-hosted map data, user accounts"], x=6.8, y=2.7, w=5.9, size=18)

s = slide("Conclusion", "Conclusion", "Close by linking the three subjects, then invite questions.")
bullets(s, ["A road network, real or drawn, becomes AX = B", "Row reduction decides existence and uniqueness", "The null space explains alternative flows as circulations",
            "Graph theory, a database and real map data complete the solution"], size=22)
text(s, 0.6, 5.7, 12.1, 0.8, "Thank you. Questions?", 30, BLUE, True, align=PP_ALIGN.CENTER)

OUT.parent.mkdir(exist_ok=True)
prs.save(OUT)
print(f"wrote {OUT} with {len(prs.slides)} slides")
