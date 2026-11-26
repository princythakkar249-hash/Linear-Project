import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Matrix } from "@/components/Matrix";
import { NetworkDiagram } from "@/components/NetworkDiagram";
import { DOCS } from "@/content/docs";
import { VIVA } from "@/content/viva";
import {
  addJunction, addRoad, chooseSolution, emptyNetwork, removeJunction, removeRoad, replay, reverseRoad, roadFlows, setEndpoints, setTwoWay,
  splitRoadAt, toNumber, updateRoad, variableNames,
} from "@/lib/graph";
import PresentationMode, { SLIDE_COUNT, SLIDE_TITLES } from "@/pages/PresentationMode";
import type { Analysis, NetworkDraft } from "@/lib/types";

function triangle(): NetworkDraft {
  let n = emptyNetwork();
  for (const at of [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 100, y: 150 }]) n = addJunction(n, at).net;
  n = addRoad(n, "J1", "J2").net;
  n = addRoad(n, "J2", "J3").net;
  n = addRoad(n, "J3", "J1").net;
  return n;
}

describe("graph editing", () => {
  it("creates junctions and roads that reference real junction ids", () => {
    const n = triangle();
    expect(n.junctions.map((j) => j.key)).toEqual(["J1", "J2", "J3"]);
    expect(n.roads.map((r) => [r.source, r.target])).toEqual([["J1", "J2"], ["J2", "J3"], ["J3", "J1"]]);
  });
  it("blocks self-loops, unknown endpoints and duplicate roads unless parallel roads are allowed", () => {
    const n = triangle();
    expect(addRoad(n, "J1", "J1").error).toMatch(/same junction/);
    expect(addRoad(n, "J1", "J9").error).toMatch(/existing/);
    expect(addRoad(n, "J1", "J2").error).toMatch(/already exists/);
    expect(addRoad(n, "J1", "J2", true).net.roads).toHaveLength(4);
    expect(addRoad(n, "J2", "J1").error).toBeUndefined();
  });
  it("deleting a junction removes every connected road and its measured flow", () => {
    const n = updateRoad(triangle(), "r1", { known_flow: "7" });
    const out = removeJunction(n, "J2");
    expect(out.junctions).toHaveLength(2);
    expect(out.roads.map((r) => r.key)).toEqual(["r3"]);
    expect(removeRoad(out, "r3").roads).toEqual([]);
  });
  it("reverses direction and toggles two-way", () => {
    const n = reverseRoad(triangle(), "r1");
    expect([n.roads[0].source, n.roads[0].target]).toEqual(["J2", "J1"]);
    const two = setTwoWay(n, "r1", true);
    expect(two.roads).toHaveLength(4);
    expect(setTwoWay(two, "r1", false).roads).toHaveLength(3);
  });
  it("changes a road's start or end junction under the same rules as drawing one", () => {
    const n = addJunction(triangle(), { x: 300, y: 300 }).net;
    const moved = setEndpoints(n, "r1", "J1", "J4");
    expect(moved.error).toBeUndefined();
    expect(moved.net.roads[0]).toMatchObject({ key: "r1", source: "J1", target: "J4" });
    expect(moved.net.roads.map((r) => r.key)).toEqual(["r1", "r2", "r3"]); // order (and variable names) unchanged
    expect(setEndpoints(n, "r1", "J2", "J2").error).toMatch(/same junction/);
    expect(setEndpoints(n, "r1", "J2", "J3").error).toMatch(/already exists/);
    expect(setEndpoints(n, "r1", "J2", "J3", true).error).toBeUndefined();
  });
  it("numbers only the unknown roads", () => {
    const n = updateRoad(triangle(), "r2", { known_flow: "4" });
    expect(variableNames(n)).toEqual({ r1: "x1", r3: "x2" });
  });
  it("splits a two-way map road at a point, keeping geometry joined", () => {
    let n: NetworkDraft = { ...emptyNetwork(), method: "map" };
    n = addJunction(n, { x: 0, y: 0, lat: 23.0, lng: 72.5 }).net;
    n = addJunction(n, { x: 100, y: 0, lat: 23.0, lng: 72.502 }).net;
    n = addRoad(n, "J1", "J2").net;
    n = setTwoWay(n, "r1", true);
    n = updateRoad(n, "r1", { known_flow: "30" });
    const out = splitRoadAt(n, "r1", [23.0, 72.501]);
    expect(out.error).toBeUndefined();
    expect(out.net.junctions).toHaveLength(3);
    expect(out.net.roads).toHaveLength(4);
    expect(out.net.roads.filter((r) => r.known_flow === "30")).toHaveLength(1);
    for (const r of out.net.roads) {
      const at = (k: string) => { const j = out.net.junctions.find((x) => x.key === k)!; return [j.lat, j.lng]; };
      expect(r.geometry![0]).toEqual(at(r.source));
      expect(r.geometry![r.geometry!.length - 1]).toEqual(at(r.target));
    }
  });
});

describe("flows and matrices", () => {
  const n = updateRoad(triangle(), "r3", { known_flow: "10" });
  const solution = { parameters: { x2: "0" }, values: { x1: "10", x2: "-3" }, roads: [], mathematically_valid: true, physically_feasible: false, negative_variables: ["x2"] };
  const analysis = {
    road_status: [{ road_key: "r1", variable: "x1", status: "determined", expression: "10" }, { road_key: "r2", variable: "x2", status: "free", expression: "t1" }, { road_key: "r3", variable: null, status: "known", expression: "10" }],
    sample_solution: solution, feasible_example: { ...solution, values: { x1: "10", x2: "4" }, physically_feasible: true },
  } as unknown as Analysis;
  it("labels known, calculated, negative and unsolved flows", () => {
    const f = roadFlows(n, analysis, solution);
    expect([f.r1.kind, f.r2.kind, f.r3.kind]).toEqual(["determined", "negative", "known"]);
    expect(f.r2.text).toBe("x2 = -3"); // never clipped to zero
    expect(roadFlows(n, null, null).r1).toMatchObject({ text: "x1", kind: "unresolved" });
  });
  it("shows a feasible example until the user chooses parameters", () => {
    expect(chooseSolution(analysis, {}).auto).toBe(true);
    expect(chooseSolution(analysis, { x2: "-3" }).solution?.values.x2).toBe("-3");
  });
  it("replays row operations", () => {
    const steps: { changed: Record<string, string[]> }[] = [{ changed: { "1": ["0", "1"] } }, { changed: { "0": ["1", "0"] } }];
    expect(replay([["1", "1"], ["2", "3"]], steps, 1)).toEqual([["1", "1"], ["0", "1"]]);
    expect(replay([["1", "1"], ["2", "3"]], steps, 2)).toEqual([["1", "0"], ["0", "1"]]);
    expect(toNumber("7/2")).toBe(3.5);
  });
});

describe("components and content", () => {
  it("renders every matrix entry", () => {
    render(<Matrix data={[["1", "0"], ["-1/2", "3"]]} />);
    ["1", "0", "-1/2", "3"].forEach((v) => expect(screen.getAllByText(v).length).toBeGreaterThan(0));
  });
  it("draws one direction arrow per road", () => {
    const { container } = render(<NetworkDiagram net={triangle()} />);
    expect(container.querySelectorAll("polyline")).toHaveLength(3);
    expect(container.querySelectorAll("[data-arrow]")).toHaveLength(3);
    expect(screen.getByText("x1")).toBeInTheDocument();
  });
  it("has the 28 documentation sections and no team contribution content", () => {
    expect(DOCS).toHaveLength(28);
    expect(JSON.stringify([DOCS, VIVA, SLIDE_TITLES])).not.toMatch(/team contribution|team member/i);
  });
  it("presentation has 21 slides and keyboard navigation", () => {
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect(SLIDE_COUNT).toBe(21);
    render(<MemoryRouter><PresentationMode /></MemoryRouter>);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("region", { name: /Slide 2:/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "End" });
    expect(screen.getByRole("region", { name: /Slide 21:/ })).toBeInTheDocument();
  });
});
