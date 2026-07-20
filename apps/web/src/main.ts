import "./style.css";

import {
  loadDistrict,
  loadScenario,
  loadScenarioIndex,
  Simulation,
} from "@lcc/sim";
import starterJson from "../../../content/districts/starter.json";
import blackoutJson from "../../../content/scenarios/blackout.json";
import bridgeOutJson from "../../../content/scenarios/bridge_out.json";
import doubleCutJson from "../../../content/scenarios/double_cut.json";
import idleWatchJson from "../../../content/scenarios/idle_watch.json";
import scenariosIndexJson from "../../../content/scenarios/index.json";
import starveTheEastJson from "../../../content/scenarios/starve_the_east.json";
import { GameApp } from "./GameApp";

const container = document.querySelector<HTMLElement>("#app") ?? document.body;
const state = loadDistrict(starterJson);
const simulation = new Simulation(state);
const scenarioIndex = loadScenarioIndex(scenariosIndexJson);
const scenarioDefsById = {
  blackout: loadScenario(blackoutJson),
  bridge_out: loadScenario(bridgeOutJson),
  double_cut: loadScenario(doubleCutJson),
  idle_watch: loadScenario(idleWatchJson),
  starve_the_east: loadScenario(starveTheEastJson),
};
const scenarios = scenarioIndex.scenarios.map((id) => {
  const scenario = scenarioDefsById[id as keyof typeof scenarioDefsById];
  if (!scenario) {
    throw new Error(`Missing scenario import: ${id}`);
  }
  return scenario;
});
const app = new GameApp(container, simulation, scenarios);

app.start();

window.addEventListener("beforeunload", () => {
  app.dispose();
});
