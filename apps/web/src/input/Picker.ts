import {
  Raycaster,
  Vector2,
  type Camera,
  type Object3D,
} from "three";

export type PickKind = "node" | "edge";

export interface PickSelection {
  id: string;
  kind: PickKind;
}

interface PickerOptions {
  camera: Camera;
  element: HTMLElement;
  getPickables: () => Iterable<Object3D>;
  onPick: (selection: PickSelection | null) => void;
  dragThresholdPx?: number;
}

interface PointerStart {
  button: number;
  id: number;
  x: number;
  y: number;
}

const DEFAULT_DRAG_THRESHOLD_PX = 4;

export class Picker {
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private pointerStart: PointerStart | null = null;
  private readonly dragThresholdPx: number;

  constructor(private readonly options: PickerOptions) {
    this.dragThresholdPx =
      options.dragThresholdPx ?? DEFAULT_DRAG_THRESHOLD_PX;
    this.options.element.addEventListener("pointerdown", this.onPointerDown);
    this.options.element.addEventListener("pointerup", this.onPointerUp);
  }

  dispose(): void {
    this.options.element.removeEventListener("pointerdown", this.onPointerDown);
    this.options.element.removeEventListener("pointerup", this.onPointerUp);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.pointerStart = {
      button: event.button,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const start = this.pointerStart;
    this.pointerStart = null;

    if (!start || start.id !== event.pointerId || start.button !== 0) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > this.dragThresholdPx) return;

    this.options.onPick(this.pick(event));
  };

  private pick(event: PointerEvent): PickSelection | null {
    const rect = this.options.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );

    this.raycaster.setFromCamera(this.pointer, this.options.camera);
    const intersections = this.raycaster.intersectObjects(
      Array.from(this.options.getPickables()),
      true,
    );

    for (const intersection of intersections) {
      const selection = pickSelectionFromObject(intersection.object);
      if (selection) return selection;
    }

    return null;
  }
}

function pickSelectionFromObject(object: Object3D): PickSelection | null {
  let current: Object3D | null = object;

  while (current) {
    const { simId, simKind } = current.userData;
    if (
      typeof simId === "string" &&
      (simKind === "node" || simKind === "edge")
    ) {
      return { id: simId, kind: simKind };
    }

    if (simKind === "token") return null;
    current = current.parent;
  }

  return null;
}
