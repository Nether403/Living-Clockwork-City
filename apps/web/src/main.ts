import "./style.css";

import { loadDistrict, Simulation } from "@lcc/sim";
import starterJson from "../../../content/districts/starter.json";
import { GameApp } from "./GameApp";

const container = document.querySelector<HTMLElement>("#app") ?? document.body;
const state = loadDistrict(starterJson);
const simulation = new Simulation(state);
const app = new GameApp(container, simulation);

app.start();

window.addEventListener("beforeunload", () => {
  app.dispose();
});
