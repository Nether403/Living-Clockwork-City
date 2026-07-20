import { describe, expect, it } from "vitest";
import {
  evaluateCaptions,
  loadScenario,
  type CaptionRule,
  type ScenarioDef,
} from "../src/scenario";
import type { FrameSnapshot, SimNode } from "../src/types";

function stock() {
  return { food: 0, energy: 0, labor: 0 };
}

function node(
  id: string,
  options: Partial<
    Pick<SimNode, "kind" | "powered" | "starving" | "idleWorkers">
  > = {},
): SimNode {
  return {
    id,
    kind: options.kind ?? "bakery",
    name: id,
    x: 0,
    z: 0,
    capacity: stock(),
    stock: stock(),
    powered: options.powered ?? true,
    operational: true,
    starving: options.starving ?? false,
    idleWorkers: options.idleWorkers ?? 0,
  };
}

function snapshot(
  nodes: SimNode[],
  demolishedIds: string[] = [],
): FrameSnapshot {
  return {
    tick: 1,
    nodes,
    edges: [],
    tokens: [],
    demolishedIds,
    demolished: demolishedIds.map((id) => ({
      id,
      kind: "edge",
      batchId: id,
      name: id,
      payloadKind: "road",
    })),
  };
}

describe("loadScenario", () => {
  it("loads scenario definitions with captions and follow-up demolish", () => {
    const scenario = loadScenario({
      id: "double_cut",
      title: "Double Cut",
      blurb: "Watch two systems fail.",
      districtId: "starter",
      camera: { x: 1, y: 2, z: 3, targetX: 4, targetZ: 5 },
      warmUpTicks: 8,
      autoDemolishId: "road_farm_bakery",
      followUp: { afterTicks: 16, demolishId: "plant_a" },
      captions: [
        {
          id: "blackout",
          when: { type: "node_unpowered", nodeId: "bakery_a" },
          text: "The bakery went dark.",
        },
      ],
    });

    expect(scenario).toMatchObject<ScenarioDef>({
      id: "double_cut",
      title: "Double Cut",
      blurb: "Watch two systems fail.",
      districtId: "starter",
      warmUpTicks: 8,
      autoDemolishId: "road_farm_bakery",
      followUp: { afterTicks: 16, demolishId: "plant_a" },
      captions: [
        {
          id: "blackout",
          when: { type: "node_unpowered", nodeId: "bakery_a" },
          text: "The bakery went dark.",
        },
      ],
    });
  });

  it("rejects invalid scenario json", () => {
    expect(() =>
      loadScenario({
        id: "broken",
        title: "Broken",
        blurb: "Missing district.",
        warmUpTicks: 0,
        captions: [],
      }),
    ).toThrow();
  });

  it("rejects duplicate caption ids", () => {
    expect(() =>
      loadScenario({
        id: "duplicate_captions",
        title: "Duplicate Captions",
        blurb: "Two captions share an id.",
        districtId: "starter",
        warmUpTicks: 0,
        captions: [
          {
            id: "same",
            when: { type: "any_home_starving" },
            text: "First.",
          },
          {
            id: "same",
            when: { type: "demolished", id: "road_bridge" },
            text: "Second.",
          },
        ],
      }),
    ).toThrow(/Duplicate caption id: same/);
  });
});

describe("evaluateCaptions", () => {
  it("returns only new captions whose predicates match", () => {
    const rules: CaptionRule[] = [
      {
        id: "home_starving",
        when: { type: "any_home_starving" },
        text: "A home is starving.",
      },
      {
        id: "bakery_dark",
        when: { type: "node_unpowered", nodeId: "bakery" },
        text: "The bakery is unpowered.",
      },
      {
        id: "already_seen",
        when: { type: "demolished", id: "road_bridge" },
        text: "The bridge is gone.",
      },
      {
        id: "not_yet",
        when: {
          type: "node_flag",
          nodeId: "workplace",
          flag: "idle_workers",
          minIdle: 3,
        },
        text: "The workplace idled.",
      },
    ];
    const snap = snapshot(
      [
        node("home", { kind: "home", starving: true }),
        node("bakery", { kind: "bakery", powered: false }),
        node("workplace", { kind: "workplace", idleWorkers: 2 }),
      ],
      ["road_bridge"],
    );

    expect(evaluateCaptions(snap, rules, new Set(["already_seen"]))).toEqual([
      { id: "home_starving", text: "A home is starving." },
      { id: "bakery_dark", text: "The bakery is unpowered." },
    ]);
  });

  it("evaluates node_flag variants", () => {
    const rules: CaptionRule[] = [
      {
        id: "starving",
        when: { type: "node_flag", nodeId: "home", flag: "starving" },
        text: "Home is starving.",
      },
      {
        id: "unpowered",
        when: { type: "node_flag", nodeId: "bakery", flag: "unpowered" },
        text: "Bakery is dark.",
      },
      {
        id: "idle_default",
        when: { type: "node_flag", nodeId: "workplace", flag: "idle_workers" },
        text: "Workers are idle.",
      },
    ];
    const snap = snapshot([
      node("home", { kind: "home", starving: true }),
      node("bakery", { kind: "bakery", powered: false }),
      node("workplace", { kind: "workplace", idleWorkers: 1 }),
    ]);

    expect(evaluateCaptions(snap, rules, new Set())).toEqual([
      { id: "starving", text: "Home is starving." },
      { id: "unpowered", text: "Bakery is dark." },
      { id: "idle_default", text: "Workers are idle." },
    ]);
  });
});
