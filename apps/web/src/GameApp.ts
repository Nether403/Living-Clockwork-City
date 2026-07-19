import type { Simulation } from "@lcc/sim";
import type { FrameSnapshot } from "@lcc/sim";
import { CityScene } from "./scene/CityScene";

const TICK_MS = 250;
const MAX_FRAME_DT_MS = 1_000;

export class GameApp {
  private readonly cityScene: CityScene;
  private frameId: number | null = null;
  private lastFrameTime = 0;
  private accumulatorMs = 0;
  private snapshot: FrameSnapshot;

  constructor(
    container: HTMLElement,
    private readonly simulation: Simulation,
  ) {
    this.cityScene = new CityScene(container);
    this.snapshot = simulation.snapshot();
    this.cityScene.sync(this.snapshot);
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
    this.accumulatorMs += dtMs;

    let stepped = false;
    while (this.accumulatorMs >= TICK_MS) {
      this.snapshot = this.simulation.tick();
      this.accumulatorMs -= TICK_MS;
      stepped = true;
    }

    if (stepped) {
      this.cityScene.sync(this.snapshot);
    }

    this.cityScene.render();
  };
}
