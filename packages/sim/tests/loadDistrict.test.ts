import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shortestRoadPath } from "../src/graph";
import { loadDistrict } from "../src/loadDistrict";
import { Simulation } from "../src/simulation";
import type { FrameSnapshot, SimNode, SimState } from "../src/types";

function loadStarter(): SimState {
  const json = JSON.parse(
    readFileSync(
      new URL("../../../content/districts/starter.json", import.meta.url),
      "utf8",
    ),
  );
  return loadDistrict(json);
}

function tickMany(sim: Simulation, count: number): FrameSnapshot {
  let snapshot = sim.snapshot();
  for (let i = 0; i < count; i++) {
    snapshot = sim.tick();
  }
  return snapshot;
}

function getNode(snapshot: FrameSnapshot, id: string): SimNode {
  const node = snapshot.nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`Missing node ${id}`);
  return node;
}

describe("loadDistrict", () => {
  it("loads starter district with runtime defaults and key ids", () => {
    const state = loadStarter();

    expect(Object.keys(state.nodes)).toEqual(
      expect.arrayContaining([
        "farm_a",
        "bakery_a",
        "market_a",
        "home_west",
        "home_east",
        "work_west",
        "work_east",
        "plant_a",
        "sub_a",
        "sub_b",
      ]),
    );
    expect(Object.keys(state.edges)).toEqual(
      expect.arrayContaining(["road_bridge", "road_farm_bakery"]),
    );

    expect(state.tick).toBe(0);
    expect(state.nextTokenId).toBe(1);
    expect(state.tokens).toEqual({});
    expect(state.demolished).toEqual([]);
    expect(state.nodes.bakery_a).toMatchObject({
      powered: false,
      operational: true,
      starving: false,
      idleWorkers: 0,
    });
  });

  it("rejects invalid district json", () => {
    expect(() => loadDistrict({ id: "broken", name: "Broken" })).toThrow();
  });
});

describe("starter map invariants", () => {
  it("keeps the named farm road and bridge as single-cut connections", () => {
    const state = loadStarter();

    const farmRoads = Object.values(state.edges)
      .filter(
        (edge) =>
          edge.kind === "road" &&
          (edge.from === "farm_a" || edge.to === "farm_a"),
      )
      .map((edge) => edge.id);
    expect(farmRoads).toEqual(["road_farm_bakery"]);

    expect(shortestRoadPath(state, "home_east", "work_west")).toContain(
      "road_bridge",
    );
    delete state.edges.road_bridge;
    expect(shortestRoadPath(state, "home_east", "work_west")).toBeNull();
  });
});

describe("starter demolish stories", () => {
  it("cutting farm road eventually starves homes", () => {
    const sim = new Simulation(loadStarter());

    sim.demolish("road_farm_bakery");
    const snapshot = tickMany(sim, 160);

    const homes = snapshot.nodes.filter((node) => node.kind === "home");
    expect(homes.some((home) => home.starving)).toBe(true);
    expect(snapshot.edges.some((edge) => edge.id === "road_farm_bakery")).toBe(
      false,
    );
  });

  it("demolishing plant unpowers bakery", () => {
    const sim = new Simulation(loadStarter());

    expect(getNode(sim.tick(), "bakery_a").powered).toBe(true);
    const snapshot = sim.demolish("plant_a");

    expect(getNode(snapshot, "bakery_a").powered).toBe(false);
    expect(snapshot.demolishedIds).toContain("plant_a");
  });

  it("removing bridge idles the west workplace", () => {
    const sim = new Simulation(loadStarter());

    expect(getNode(sim.tick(), "work_west").idleWorkers).toBe(0);
    sim.demolish("road_bridge");
    const snapshot = tickMany(sim, 32);

    expect(getNode(snapshot, "work_west").idleWorkers).toBeGreaterThan(0);
  });
});
