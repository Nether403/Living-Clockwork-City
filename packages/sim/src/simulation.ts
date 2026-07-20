import {
  consume,
  dispatch,
  produce,
  updatePowerFlags,
} from "./economy.js";
import {
  advanceTokens,
  strandTokensAtNode,
  strandTokensOnEdge,
} from "./tokens.js";
import type {
  DemolishedRecord,
  DemolishedSnapshotRecord,
  EdgeKind,
  FrameSnapshot,
  NodeKind,
  SimEdge,
  SimNode,
  SimState,
  StockPile,
} from "./types.js";

export class Simulation {
  constructor(private state: SimState) {}

  static fromMiniChain(): Simulation {
    const state: SimState = {
      tick: 0,
      nextTokenId: 1,
      tokens: {},
      demolished: [],
      nodes: {
        plant: node("plant", "power_plant", { powered: true }),
        sub: node("sub", "substation"),
        farm: node("farm", "farm", {
          capacity: stock(10, 0, 0),
          stock: stock(5, 0, 0),
        }),
        bakery: node("bakery", "bakery", { capacity: stock(10, 0, 0) }),
        market: node("market", "market", { capacity: stock(10, 0, 0) }),
        home: node("home", "home", {
          capacity: stock(10, 0, 10),
          stock: stock(2, 0, 1),
        }),
        workplace: node("workplace", "workplace", {
          capacity: stock(0, 0, 10),
          stock: stock(0, 0, 0),
        }),
      },
      edges: {
        power_sub: edge("power_sub", "plant", "sub", "power", 1, 99),
        power_farm: edge("power_farm", "sub", "farm", "power", 1, 99),
        power_bakery: edge("power_bakery", "sub", "bakery", "power", 1, 99),
        power_home: edge("power_home", "sub", "home", "power", 1, 99),
        power_workplace: edge(
          "power_workplace",
          "sub",
          "workplace",
          "power",
          1,
          99,
        ),
        road_farm_bakery: edge(
          "road_farm_bakery",
          "farm",
          "bakery",
          "road",
          2,
          2,
        ),
        road_bakery_market: edge(
          "road_bakery_market",
          "bakery",
          "market",
          "road",
          2,
          2,
        ),
        road_market_home: edge(
          "road_market_home",
          "market",
          "home",
          "road",
          2,
          2,
        ),
        road_home_workplace: edge(
          "road_home_workplace",
          "home",
          "workplace",
          "road",
          2,
          2,
        ),
      },
    };
    updatePowerFlags(state);
    return new Simulation(state);
  }

  tick(): FrameSnapshot {
    updatePowerFlags(this.state);
    produce(this.state);
    dispatch(this.state);
    advanceTokens(this.state);
    consume(this.state);
    this.state.tick += 1;
    return this.snapshot();
  }

  demolish(id: string): FrameSnapshot {
    const nodeToDemolish = this.state.nodes[id];
    if (nodeToDemolish) {
      this.demolishNode(nodeToDemolish);
      updatePowerFlags(this.state);
      return this.snapshot();
    }

    const edgeToDemolish = this.state.edges[id];
    if (edgeToDemolish) {
      this.demolishEdge(edgeToDemolish, id);
      updatePowerFlags(this.state);
      return this.snapshot();
    }

    throw new Error(`Unknown id: ${id}`);
  }

  restore(id: string): FrameSnapshot {
    const records = this.state.demolished.filter(
      (record) => (record.batchId ?? record.id) === id,
    );
    if (records.length === 0) {
      throw new Error(`Nothing to restore: ${id}`);
    }

    for (const record of records) {
      if (record.kind === "node") {
        this.state.nodes[record.id] = record.payload as SimNode;
      } else {
        this.state.edges[record.id] = record.payload as SimEdge;
      }
    }

    this.state.demolished = this.state.demolished.filter(
      (record) => (record.batchId ?? record.id) !== id,
    );
    updatePowerFlags(this.state);
    return this.snapshot();
  }

  snapshot(): FrameSnapshot {
    return {
      tick: this.state.tick,
      nodes: Object.values(this.state.nodes),
      edges: Object.values(this.state.edges),
      tokens: Object.values(this.state.tokens),
      demolishedIds: [
        ...new Set(
          this.state.demolished.map((record) => record.batchId ?? record.id),
        ),
      ],
      demolished: this.state.demolished.map(toDemolishedSnapshotRecord),
    };
  }

  getState(): Readonly<SimState> {
    return this.state;
  }

  private demolishNode(nodeToDemolish: SimNode): void {
    const batchId = nodeToDemolish.id;
    const incidentEdges = Object.values(this.state.edges).filter(
      (edge) => edge.from === batchId || edge.to === batchId,
    );

    delete this.state.nodes[batchId];
    for (const edgeToRemove of incidentEdges) {
      delete this.state.edges[edgeToRemove.id];
    }

    strandTokensAtNode(this.state, batchId);
    for (const edgeToRemove of incidentEdges) {
      strandTokensOnEdge(this.state, edgeToRemove.id);
    }

    this.state.demolished.push(record("node", nodeToDemolish, batchId));
    for (const edgeToRemove of incidentEdges) {
      this.state.demolished.push(record("edge", edgeToRemove, batchId));
    }
  }

  private demolishEdge(edgeToDemolish: SimEdge, batchId: string): void {
    delete this.state.edges[edgeToDemolish.id];
    strandTokensOnEdge(this.state, edgeToDemolish.id);
    this.state.demolished.push(record("edge", edgeToDemolish, batchId));
  }
}

function toDemolishedSnapshotRecord(
  record: DemolishedRecord,
): DemolishedSnapshotRecord {
  const batchId = record.batchId ?? record.id;
  const payload = record.payload;

  return {
    id: record.id,
    kind: record.kind,
    batchId,
    name: "name" in payload ? payload.name : payload.id,
    payloadKind: payload.kind,
  };
}

function record(
  kind: "node",
  payload: SimNode,
  batchId: string,
): DemolishedRecord;
function record(
  kind: "edge",
  payload: SimEdge,
  batchId: string,
): DemolishedRecord;
function record(
  kind: "node" | "edge",
  payload: SimNode | SimEdge,
  batchId: string,
): DemolishedRecord {
  return {
    kind,
    id: payload.id,
    batchId,
    payload,
  };
}

function stock(food = 0, energy = 0, labor = 0): StockPile {
  return { food, energy, labor };
}

function node(
  id: string,
  kind: NodeKind,
  options: Partial<
    Pick<SimNode, "capacity" | "stock" | "powered" | "starving">
  > = {},
): SimNode {
  return {
    id,
    kind,
    name: id,
    x: 0,
    z: 0,
    capacity: options.capacity ?? stock(10, 0, 10),
    stock: options.stock ?? stock(),
    powered: options.powered ?? false,
    operational: true,
    starving: options.starving ?? false,
    idleWorkers: 0,
  };
}

function edge(
  id: string,
  from: string,
  to: string,
  kind: EdgeKind,
  traversalTicks: number,
  capacity: number,
): SimEdge {
  return {
    id,
    from,
    to,
    kind,
    traversalTicks,
    capacity,
  };
}
