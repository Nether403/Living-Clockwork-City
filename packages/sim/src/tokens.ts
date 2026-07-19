import type { ResourceKind, SimState, Token } from "./types.js";

export function countTokensOnEdge(state: SimState, edgeId: string): number {
  return Object.values(state.tokens).filter(
    (t) => t.state === "moving" && t.at === edgeId,
  ).length;
}

export function strandTokensOnEdge(state: SimState, edgeId: string): void {
  for (const t of Object.values(state.tokens)) {
    if (t.state === "moving" && t.at === edgeId) {
      t.state = "stranded";
      t.progress = 0;
    }
  }
}

export function strandTokensAtNode(state: SimState, nodeId: string): void {
  for (const t of Object.values(state.tokens)) {
    if (
      (t.state === "queued" || t.state === "moving") &&
      (t.at === nodeId || dependsOnNode(state, t, nodeId))
    ) {
      t.state = "stranded";
      t.at = nodeId;
      t.progress = 0;
    }
  }
}

function dependsOnNode(state: SimState, token: Token, nodeId: string): boolean {
  if (token.state !== "moving") return false;
  const edge = state.edges[token.at];
  return !!edge && (edge.from === nodeId || edge.to === nodeId);
}

export function advanceTokens(state: SimState): void {
  for (const token of Object.values(state.tokens)) {
    if (token.state !== "moving") continue;
    const edge = state.edges[token.at];
    if (!edge) {
      token.state = "stranded";
      continue;
    }
    const step = 1 / Math.max(1, edge.traversalTicks);
    token.progress += step;
    if (token.progress >= 1) {
      const arrivedAt = edge.to;
      if (arrivedAt === token.destination) {
        deliverFinal(state, token, arrivedAt);
      } else {
        token.state = "queued";
        token.at = arrivedAt;
        token.progress = 0;
      }
    }
  }
}

function deliverFinal(state: SimState, token: Token, nodeId: string): void {
  const node = state.nodes[nodeId];
  if (!node) {
    token.state = "stranded";
    return;
  }
  addStock(node.stock, token.resource, 1);
  token.state = "delivered";
  token.at = nodeId;
  token.progress = 0;
}

function addStock(
  stock: { food: number; energy: number; labor: number },
  resource: ResourceKind,
  amount: number,
): void {
  stock[resource] += amount;
}
