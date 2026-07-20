import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  loadScenario,
  loadScenarioIndex,
  type ScenarioDef,
} from "../src/scenario";

const scenariosUrl = new URL(
  "../../../content/scenarios/",
  import.meta.url,
);

const expectedScenarioIds = [
  "idle_watch",
  "starve_the_east",
  "blackout",
  "bridge_out",
  "double_cut",
] as const;

function readJson(filename: string): unknown {
  return JSON.parse(readFileSync(new URL(filename, scenariosUrl), "utf8"));
}

function loadScenarioFile(id: string): ScenarioDef {
  return loadScenario(readJson(`${id}.json`));
}

describe("scenario content", () => {
  it("loads the scenario index in menu order", () => {
    const index = loadScenarioIndex(readJson("index.json"));

    expect(index.scenarios).toEqual(expectedScenarioIds);
  });

  it("loads every indexed scenario file", () => {
    const index = loadScenarioIndex(readJson("index.json"));
    const scenarios = index.scenarios.map(loadScenarioFile);

    expect(scenarios.map((scenario) => scenario.id)).toEqual(
      expectedScenarioIds,
    );
    expect(scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ districtId: "starter" }),
      ]),
    );
    for (const scenario of scenarios) {
      expect(scenario.districtId).toBe("starter");
      expect(Number.isInteger(scenario.warmUpTicks)).toBe(true);
      expect(Array.isArray(scenario.captions)).toBe(true);
    }
  });

  it("wires the authored demolish actions and key captions", () => {
    const scenarios = Object.fromEntries(
      expectedScenarioIds.map((id) => [id, loadScenarioFile(id)]),
    );

    expect(scenarios.idle_watch.autoDemolishId).toBeUndefined();
    expect(scenarios.idle_watch.warmUpTicks).toBe(0);

    expect(scenarios.starve_the_east.autoDemolishId).toBe(
      "road_farm_bakery",
    );
    expect(scenarios.starve_the_east.captions).toContainEqual(
      expect.objectContaining({ when: { type: "any_home_starving" } }),
    );

    expect(scenarios.blackout.autoDemolishId).toBe("plant_a");
    expect(scenarios.blackout.captions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          when: { type: "node_unpowered", nodeId: "bakery_a" },
        }),
        expect.objectContaining({ when: { type: "demolished", id: "plant_a" } }),
      ]),
    );

    expect(scenarios.bridge_out.autoDemolishId).toBe("road_bridge");
    expect(scenarios.bridge_out.captions).toContainEqual(
      expect.objectContaining({
        when: {
          type: "node_flag",
          nodeId: "work_west",
          flag: "idle_workers",
          minIdle: 1,
        },
      }),
    );

    expect(scenarios.double_cut.autoDemolishId).toBe("road_farm_bakery");
    expect(scenarios.double_cut.followUp).toEqual({
      afterTicks: 20,
      demolishId: "plant_a",
    });
    expect(scenarios.double_cut.captions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ when: { type: "any_home_starving" } }),
        expect.objectContaining({
          when: { type: "node_unpowered", nodeId: "bakery_a" },
        }),
      ]),
    );
  });
});
