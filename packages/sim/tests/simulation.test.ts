import { describe, expect, it } from "vitest";
import { Simulation } from "../src/simulation";

describe("Simulation.demolish", () => {
  it("darkens bakery when power plant is demolished", () => {
    const sim = Simulation.fromMiniChain();
    for (let i = 0; i < 5; i++) sim.tick();

    sim.demolish("plant");

    const snap = sim.snapshot();
    const bakery = snap.nodes.find((n) => n.id === "bakery")!;
    expect(bakery.powered).toBe(false);
    expect(snap.demolishedIds).toContain("plant");
  });

  it("restore brings power back", () => {
    const sim = Simulation.fromMiniChain();

    sim.demolish("plant");
    sim.restore("plant");

    const bakery = sim.snapshot().nodes.find((n) => n.id === "bakery")!;
    expect(bakery.powered).toBe(true);
  });

  it("demolishing a road edge strands moving tokens", () => {
    const sim = Simulation.fromMiniChain();
    sim.tick();

    const moving = sim
      .snapshot()
      .tokens.find((token) => token.at === "road_farm_bakery");
    expect(moving?.state).toBe("moving");

    const snap = sim.demolish("road_farm_bakery");

    expect(snap.edges.some((edge) => edge.id === "road_farm_bakery")).toBe(false);
    expect(snap.tokens.find((token) => token.id === moving!.id)?.state).toBe(
      "stranded",
    );
    expect(snap.demolishedIds).toContain("road_farm_bakery");
  });

  it("includes demolished payload details in snapshots", () => {
    const sim = Simulation.fromMiniChain();
    const snap = sim.demolish("plant");

    expect(snap.demolished).toEqual(
      expect.arrayContaining([
        {
          id: "plant",
          kind: "node",
          batchId: "plant",
          name: "plant",
          payloadKind: "power_plant",
        },
        {
          id: "power_sub",
          kind: "edge",
          batchId: "plant",
          name: "power_sub",
          payloadKind: "power",
        },
      ]),
    );
  });
});
