import type {
  DemolishedSnapshotRecord,
  FrameSnapshot,
  SimEdge,
  SimNode,
  StockPile,
} from "@lcc/sim";
import type { PickSelection } from "../input/Picker";

interface InspectPanelOptions {
  container: HTMLElement;
  onDemolish: (id: string) => void;
  onRestore: (id: string) => void;
}

interface SelectionState {
  demolished: boolean;
  demolishedRecord: DemolishedSnapshotRecord | undefined;
  edge: SimEdge | undefined;
  node: SimNode | undefined;
  selection: PickSelection;
}

export class InspectPanel {
  private readonly root = document.createElement("aside");
  private readonly eyebrow = document.createElement("div");
  private readonly title = document.createElement("h2");
  private readonly meta = document.createElement("div");
  private readonly details = document.createElement("dl");
  private readonly demolishButton = document.createElement("button");
  private readonly restoreButton = document.createElement("button");
  private currentSelection: PickSelection | null = null;

  constructor(private readonly options: InspectPanelOptions) {
    this.root.className = "inspect-panel";
    this.root.hidden = true;

    this.eyebrow.className = "inspect-panel__eyebrow";
    this.title.className = "inspect-panel__title";
    this.meta.className = "inspect-panel__meta";
    this.details.className = "inspect-panel__details";

    const actions = document.createElement("div");
    actions.className = "inspect-panel__actions";

    this.demolishButton.type = "button";
    this.demolishButton.textContent = "Demolish";
    this.demolishButton.addEventListener("click", () => {
      if (this.currentSelection) {
        this.options.onDemolish(this.currentSelection.id);
      }
    });

    this.restoreButton.type = "button";
    this.restoreButton.textContent = "Restore";
    this.restoreButton.addEventListener("click", () => {
      if (this.currentSelection) {
        this.options.onRestore(this.currentSelection.id);
      }
    });

    actions.append(this.demolishButton, this.restoreButton);
    this.root.append(
      this.eyebrow,
      this.title,
      this.meta,
      this.details,
      actions,
    );
    this.options.container.append(this.root);
  }

  render(
    snapshot: FrameSnapshot,
    selection: PickSelection | null,
  ): void {
    this.currentSelection = selection;

    if (!selection) {
      this.root.hidden = true;
      return;
    }

    const state = resolveSelectionState(snapshot, selection);
    this.root.hidden = false;
    this.eyebrow.textContent = state.demolished ? "Demolished" : "Selected";
    this.title.textContent = selectionName(state);
    this.meta.textContent = selectionMeta(state);
    this.details.replaceChildren(...detailRows(snapshot, state));

    const active = Boolean(state.node ?? state.edge);
    this.demolishButton.disabled = !active || state.demolished;
    this.restoreButton.disabled = !state.demolished;
  }

  dispose(): void {
    this.root.remove();
  }
}

function resolveSelectionState(
  snapshot: FrameSnapshot,
  selection: PickSelection,
): SelectionState {
  const node = snapshot.nodes.find((candidate) => candidate.id === selection.id);
  const edge = snapshot.edges.find((candidate) => candidate.id === selection.id);
  const demolishedRecord = resolveDemolishedRecord(snapshot, selection.id);

  return {
    demolished:
      snapshot.demolishedIds.includes(selection.id) ||
      demolishedRecord !== undefined,
    demolishedRecord,
    edge,
    node,
    selection,
  };
}

function selectionName(state: SelectionState): string {
  return (
    state.node?.name ??
    state.demolishedRecord?.name ??
    state.edge?.id ??
    state.selection.id
  );
}

function selectionMeta(state: SelectionState): string {
  const objectKind = state.selection.kind === "node" ? "Node" : "Edge";
  const simKind =
    state.node?.kind ?? state.edge?.kind ?? state.demolishedRecord?.payloadKind;
  return simKind ? `${objectKind} - ${formatKind(simKind)}` : objectKind;
}

function detailRows(
  snapshot: FrameSnapshot,
  state: SelectionState,
): HTMLElement[] {
  const rows: HTMLElement[] = [
    detailRow("ID", state.selection.id),
    detailRow("Status", state.demolished ? "Demolished" : "Active"),
  ];

  if (state.node) {
    rows.push(
      detailRow("Powered", state.node.powered ? "Yes" : "No"),
      detailRow("Stock", formatStock(state.node.stock)),
      detailRow("Queued", String(queueCount(snapshot, state.node.id))),
    );
    if (state.node.thirsty) {
      rows.push(detailRow("Thirsty", "Yes"));
    }
    if (state.node.clogged) {
      rows.push(detailRow("Clogged", "Yes"));
    }
    if (state.node.starving) {
      rows.push(detailRow("Starving", "Yes"));
    }
  } else if (state.edge) {
    rows.push(
      detailRow("From", state.edge.from),
      detailRow("To", state.edge.to),
      detailRow("Capacity", String(state.edge.capacity)),
    );
  } else if (state.demolishedRecord) {
    rows.push(
      detailRow("Name", state.demolishedRecord.name),
      detailRow("Kind", formatKind(state.demolishedRecord.payloadKind)),
      detailRow("Payload", formatKind(state.demolishedRecord.kind)),
    );
  } else {
    rows.push(detailRow("Stock", "Unavailable"));
  }

  return rows;
}

function resolveDemolishedRecord(
  snapshot: FrameSnapshot,
  selectionId: string,
): DemolishedSnapshotRecord | undefined {
  return (
    snapshot.demolished.find((record) => record.id === selectionId) ??
    snapshot.demolished.find((record) => record.batchId === selectionId)
  );
}

function detailRow(label: string, value: string): HTMLElement {
  const fragment = document.createElement("div");
  fragment.className = "inspect-panel__row";

  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  fragment.append(term, description);
  return fragment;
}

function formatStock(stock: StockPile): string {
  return `Food ${stock.food} · Water ${stock.water} · Waste ${stock.waste} · Labor ${stock.labor}`;
}

function formatKind(kind: string): string {
  return kind.replaceAll("_", " ");
}

function queueCount(snapshot: FrameSnapshot, nodeId: string): number {
  return snapshot.tokens.filter(
    (token) => token.state === "queued" && token.at === nodeId,
  ).length;
}
