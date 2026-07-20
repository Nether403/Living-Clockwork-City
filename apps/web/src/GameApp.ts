import type { Simulation } from "@lcc/sim";
import type { FrameSnapshot } from "@lcc/sim";
import { Picker, type PickSelection } from "./input/Picker";
import { CityScene } from "./scene/CityScene";
import { InspectPanel } from "./ui/InspectPanel";

const TICK_MS = 250;
const MAX_FRAME_DT_MS = 1_000;
const SPEEDS = [0.5, 1, 2] as const;
type SpeedMultiplier = (typeof SPEEDS)[number];

export class GameApp {
  private readonly cityScene: CityScene;
  private readonly inspectPanel: InspectPanel;
  private readonly picker: Picker;
  private frameId: number | null = null;
  private lastFrameTime = 0;
  private accumulatorMs = 0;
  private snapshot: FrameSnapshot;
  private selected: PickSelection | null = null;
  private paused = false;
  private speed: SpeedMultiplier = 1;

  constructor(
    container: HTMLElement,
    private readonly simulation: Simulation,
  ) {
    this.cityScene = new CityScene(container);
    this.inspectPanel = new InspectPanel({
      container,
      onDemolish: this.demolishSelection,
      onRestore: this.restoreSelection,
    });
    this.picker = new Picker({
      camera: this.cityScene.pickCamera,
      element: this.cityScene.canvas,
      getPickables: () => this.cityScene.getPickableObjects(),
      onPick: this.select,
    });
    this.snapshot = simulation.snapshot();
    this.syncSnapshot(this.snapshot);
    window.addEventListener("keydown", this.onKeyDown);
  }

  start(): void {
    if (this.frameId !== null) return;
    this.lastFrameTime = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  dispose(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    window.removeEventListener("keydown", this.onKeyDown);
    this.picker.dispose();
    this.inspectPanel.dispose();
    this.cityScene.dispose();
  }

  private readonly frame = (timeMs: number): void => {
    this.frameId = requestAnimationFrame(this.frame);

    if (document.hidden) {
      this.lastFrameTime = timeMs;
      return;
    }

    const dtMs = Math.min(timeMs - this.lastFrameTime, MAX_FRAME_DT_MS);
    this.lastFrameTime = timeMs;
    if (this.paused) {
      this.cityScene.render();
      return;
    }

    this.accumulatorMs += dtMs * this.speed;

    let stepped = false;
    while (this.accumulatorMs >= TICK_MS) {
      this.snapshot = this.simulation.tick();
      this.accumulatorMs -= TICK_MS;
      stepped = true;
    }

    if (stepped) {
      this.syncSnapshot(this.snapshot);
    }

    this.cityScene.render();
  };

  private readonly select = (selection: PickSelection | null): void => {
    this.selected = selection;
    this.cityScene.setSelection(selection);
    this.inspectPanel.render(this.snapshot, selection);
  };

  private readonly demolishSelection = (id: string): void => {
    this.accumulatorMs = 0;
    this.syncSnapshot(this.simulation.demolish(id));
  };

  private readonly restoreSelection = (id: string): void => {
    this.accumulatorMs = 0;
    this.syncSnapshot(this.simulation.restore(id));
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target)) return;

    if (event.code === "Space") {
      event.preventDefault();
      this.paused = !this.paused;
      return;
    }

    if (event.key === "[") {
      this.setSpeedStep(-1);
      return;
    }

    if (event.key === "]") {
      this.setSpeedStep(1);
    }
  };

  private setSpeedStep(direction: -1 | 1): void {
    const currentIndex = SPEEDS.indexOf(this.speed);
    const nextIndex = Math.min(
      Math.max(currentIndex + direction, 0),
      SPEEDS.length - 1,
    );
    this.speed = SPEEDS[nextIndex];
  }

  private syncSnapshot(snapshot: FrameSnapshot): void {
    this.snapshot = snapshot;
    this.cityScene.sync(snapshot);
    this.cityScene.setSelection(this.selected);
    this.inspectPanel.render(snapshot, this.selected);
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
