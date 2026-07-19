export type ResourceKind = "food" | "energy" | "labor";

export type NodeKind =
  | "home"
  | "farm"
  | "bakery"
  | "market"
  | "workplace"
  | "power_plant"
  | "substation"
  | "junction";

export type EdgeKind = "road" | "power";

export type TokenState = "moving" | "queued" | "delivered" | "stranded";

export interface StockPile {
  food: number;
  energy: number;
  labor: number;
}

export interface SimNode {
  id: string;
  kind: NodeKind;
  name: string;
  x: number;
  z: number;
  capacity: StockPile;
  stock: StockPile;
  powered: boolean;
  operational: boolean;
  starving: boolean;
  idleWorkers: number;
}

export interface SimEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  traversalTicks: number;
  capacity: number;
}

export interface Token {
  id: string;
  resource: ResourceKind;
  state: TokenState;
  /** Node id when queued/stranded/delivered; edge id when moving */
  at: string;
  /** Node id this token will arrive at when it completes the current edge */
  headingTo: string;
  /** 0..1 progress along edge when moving */
  progress: number;
  destination: string;
}

export interface DemolishedRecord {
  kind: "node" | "edge";
  id: string;
  /** Serialized original so restore can put it back */
  payload: SimNode | SimEdge;
}

export interface SimState {
  tick: number;
  nodes: Record<string, SimNode>;
  edges: Record<string, SimEdge>;
  tokens: Record<string, Token>;
  demolished: DemolishedRecord[];
  nextTokenId: number;
}

export interface FrameSnapshot {
  tick: number;
  nodes: SimNode[];
  edges: SimEdge[];
  tokens: Token[];
  demolishedIds: string[];
}
