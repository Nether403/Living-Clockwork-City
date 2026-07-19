import { describe, expect, it } from "vitest";
import { getPowerReachable, shortestRoadPath } from "../src/graph";
import type { SimState } from "../src/types";

function emptyStock() {
  return { food: 0, energy: 0, labor: 0 };
}

function baseState(): SimState {
  return {
    tick: 0,
    nextTokenId: 1,
    tokens: {},
    demolished: [],
    nodes: {
      plant: {
        id: "plant",
        kind: "power_plant",
        name: "Plant",
        x: 0,
        z: 0,
        capacity: emptyStock(),
        stock: emptyStock(),
        powered: true,
        operational: true,
        starving: false,
        idleWorkers: 0,
      },
      sub: {
        id: "sub",
        kind: "substation",
        name: "Sub",
        x: 1,
        z: 0,
        capacity: emptyStock(),
        stock: emptyStock(),
        powered: false,
        operational: true,
        starving: false,
        idleWorkers: 0,
      },
      bakery: {
        id: "bakery",
        kind: "bakery",
        name: "Bakery",
        x: 2,
        z: 0,
        capacity: emptyStock(),
        stock: emptyStock(),
        powered: false,
        operational: true,
        starving: false,
        idleWorkers: 0,
      },
      farm: {
        id: "farm",
        kind: "farm",
        name: "Farm",
        x: 0,
        z: 1,
        capacity: emptyStock(),
        stock: emptyStock(),
        powered: false,
        operational: true,
        starving: false,
        idleWorkers: 0,
      },
    },
    edges: {
      p1: {
        id: "p1",
        from: "plant",
        to: "sub",
        kind: "power",
        traversalTicks: 1,
        capacity: 99,
      },
      p2: {
        id: "p2",
        from: "sub",
        to: "bakery",
        kind: "power",
        traversalTicks: 1,
        capacity: 99,
      },
      r1: {
        id: "r1",
        from: "farm",
        to: "bakery",
        kind: "road",
        traversalTicks: 4,
        capacity: 2,
      },
    },
  };
}

describe("getPowerReachable", () => {
  it("marks nodes connected to an operational plant", () => {
    const reachable = getPowerReachable(baseState());
    expect(reachable.has("plant")).toBe(true);
    expect(reachable.has("sub")).toBe(true);
    expect(reachable.has("bakery")).toBe(true);
    expect(reachable.has("farm")).toBe(false);
  });

  it("returns only the plant when power line is missing", () => {
    const state = baseState();
    delete state.edges.p1;
    const reachable = getPowerReachable(state);
    expect([...reachable]).toEqual(["plant"]);
  });
});

describe("shortestRoadPath", () => {
  it("finds the farm→bakery road", () => {
    const path = shortestRoadPath(baseState(), "farm", "bakery");
    expect(path).toEqual(["r1"]);
  });

  it("returns null when disconnected", () => {
    const state = baseState();
    delete state.edges.r1;
    expect(shortestRoadPath(state, "farm", "bakery")).toBeNull();
  });
});
