import type { ScenarioDef } from "@lcc/sim";

interface ScenarioMenuOptions {
  container: HTMLElement;
  scenarios: ScenarioDef[];
  onRun: (scenarioId: string) => void;
}

export class ScenarioMenu {
  private readonly root = document.createElement("aside");
  private readonly items = new Map<string, HTMLButtonElement>();
  private activeId: string | null = null;

  constructor(private readonly options: ScenarioMenuOptions) {
    this.root.className = "scenario-menu";
    this.root.setAttribute("aria-label", "Scenarios");

    const heading = document.createElement("div");
    heading.className = "scenario-menu__heading";
    heading.textContent = "Scenarios";

    const list = document.createElement("div");
    list.className = "scenario-menu__list";

    for (const scenario of options.scenarios) {
      const item = this.createScenarioButton(scenario);
      this.items.set(scenario.id, item);
      list.append(item);
    }

    this.root.append(heading, list);
    this.options.container.append(this.root);
  }

  setActive(scenarioId: string | null): void {
    this.activeId = scenarioId;

    for (const [id, item] of this.items) {
      const isActive = id === scenarioId;
      item.classList.toggle("scenario-menu__item--active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    }
  }

  dispose(): void {
    this.root.remove();
    this.items.clear();
  }

  private createScenarioButton(scenario: ScenarioDef): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scenario-menu__item";
    button.setAttribute("aria-pressed", "false");

    const title = document.createElement("span");
    title.className = "scenario-menu__title";
    title.textContent = scenario.title;

    const blurb = document.createElement("span");
    blurb.className = "scenario-menu__blurb";
    blurb.textContent = scenario.blurb;

    button.append(title, blurb);
    button.addEventListener("click", () => {
      if (this.activeId !== scenario.id) {
        this.setActive(scenario.id);
      }
      this.options.onRun(scenario.id);
    });

    return button;
  }
}
