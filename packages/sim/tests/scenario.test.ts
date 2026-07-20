import { describe, expect, it } from "vitest";
import {
  advanceScenario,
  createScenarioRuntime,
  evaluateCaptions,
  loadScenario,
  type CaptionRule,
  type ScenarioDef,
} from "../src/scenario";
import { Simulation } from "../src/simulation";
import type { FrameSnapshot, SimNode } from "../src/types";

function stock() {
  return { food: 0, energy: 0, labor: 0, water: 0, waste: 0 };
}

function node(
  id: string,
  options: Partial<
    Pick<SimNode, "kind" | "powered" | "starving" | "idleWorkers" | "thirsty" | "clogged">
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
    thirsty: options.thirsty ?? false,
    clogged: options.clogged ?? false,
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

  it("evaluates thirsty and clogged captions", () => {
    const rules: CaptionRule[] = [
      {
        id: "thirsty",
        when: { type: "node_flag", nodeId: "bakery", flag: "thirsty" },
        text: "Bakery is thirsty.",
      },
      {
        id: "clogged",
        when: { type: "any_home_clogged" },
        text: "Homes are clogged.",
      },
    ];
    const snap = snapshot([
      node("bakery", { kind: "bakery", thirsty: true }),
      node("home", { kind: "home", clogged: true }),
    ]);

    expect(evaluateCaptions(snap, rules, new Set())).toEqual([
      { id: "thirsty", text: "Bakery is thirsty." },
      { id: "clogged", text: "Homes are clogged." },
    ]);
  });
});

describe("scenario runtime", () => {
  it("initializes runtime state from the scenario definition", () => {
    const def: ScenarioDef = {
      id: "runtime",
      title: "Runtime",
      blurb: "State setup.",
      districtId: "starter",
      warmUpTicks: 3,
      autoDemolishId: "plant",
      captions: [],
    };

    const state = createScenarioRuntime(def);

    expect(state).toEqual({
      def,
      warmUpRemaining: 3,
      followUpRemaining: null,
      firedCaptions: new Set(),
      autoDemolishDone: false,
      followUpDone: false,
    });
  });

  it("waits for warmup before auto-demolishing and fires post-demolish captions", () => {
    const sim = Simulation.fromMiniChain();
    const state = createScenarioRuntime({
      id: "blackout",
      title: "Blackout",
      blurb: "Power fails after a short warmup.",
      districtId: "starter",
      warmUpTicks: 1,
      autoDemolishId: "plant",
      captions: [
        {
          id: "bakery_dark",
          when: { type: "node_unpowered", nodeId: "bakery" },
          text: "The bakery went dark.",
        },
        {
          id: "plant_down",
          when: { type: "demolished", id: "plant" },
          text: "The power plant is gone.",
        },
      ],
    });

    expect(advanceScenario(state, sim, sim.tick())).toEqual({
      captions: [],
      didDemolish: false,
    });
    expect(state.warmUpRemaining).toBe(0);
    expect(sim.snapshot().demolishedIds).not.toContain("plant");

    expect(advanceScenario(state, sim, sim.tick())).toEqual({
      captions: [
        { id: "bakery_dark", text: "The bakery went dark." },
        { id: "plant_down", text: "The power plant is gone." },
      ],
      didDemolish: true,
    });
    expect(state.autoDemolishDone).toBe(true);
    expect(state.firedCaptions).toEqual(new Set(["bakery_dark", "plant_down"]));

    expect(advanceScenario(state, sim, sim.tick())).toEqual({
      captions: [],
      didDemolish: false,
    });
  });

  it("runs a follow-up demolish after its delay", () => {
    const sim = Simulation.fromMiniChain();
    const state = createScenarioRuntime({
      id: "double_cut",
      title: "Double Cut",
      blurb: "Two roads fail in sequence.",
      districtId: "starter",
      warmUpTicks: 0,
      autoDemolishId: "road_farm_bakery",
      followUp: { afterTicks: 1, demolishId: "road_bakery_market" },
      captions: [
        {
          id: "first_cut",
          when: { type: "demolished", id: "road_farm_bakery" },
          text: "The first road is gone.",
        },
        {
          id: "second_cut",
          when: { type: "demolished", id: "road_bakery_market" },
          text: "The second road is gone.",
        },
      ],
    });

    expect(advanceScenario(state, sim, sim.tick())).toEqual({
      captions: [{ id: "first_cut", text: "The first road is gone." }],
      didDemolish: true,
    });
    expect(state.followUpRemaining).toBe(1);
    expect(sim.snapshot().demolishedIds).toContain("road_farm_bakery");

    expect(advanceScenario(state, sim, sim.tick())).toEqual({
      captions: [],
      didDemolish: false,
    });
    expect(state.followUpRemaining).toBe(0);
    expect(sim.snapshot().demolishedIds).not.toContain("road_bakery_market");

    expect(advanceScenario(state, sim, sim.tick())).toEqual({
      captions: [{ id: "second_cut", text: "The second road is gone." }],
      didDemolish: true,
    });
    expect(state.followUpDone).toBe(true);
    expect(state.followUpRemaining).toBeNull();
    expect(sim.snapshot().demolishedIds).toEqual(
      expect.arrayContaining(["road_farm_bakery", "road_bakery_market"]),
    );
  });
});
