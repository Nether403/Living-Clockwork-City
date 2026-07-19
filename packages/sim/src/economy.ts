import { getPowerReachable, shortestRoadPath } from "./graph.js";
import { countTokensOnEdge } from "./tokens.js";
import type { NodeKind, ResourceKind, SimNode, SimState, Token } from "./types.js";

type DispatchPlan = {
  resource: ResourceKind;
  targetKind: NodeKind;
};

export function updatePowerFlags(state: SimState): void {
  const powered = getPowerReachable(state);
  for (const node of Object.values(state.nodes)) {
    if (node.kind === "power_plant" && node.operational) {
      node.powered = true;
    } else {
      node.powered = powered.has(node.id);
    }
  }
}

export function produce(state: SimState): void {
  for (const node of Object.values(state.nodes)) {
    if (!node.operational || !node.powered) continue;
    if (node.kind === "farm" && state.tick % 4 === 0) {
      if (node.stock.food < node.capacity.food) {
        node.stock.food += 1;
      }
    }
  }
}

export function dispatch(state: SimState): void {
  regenerateHomeLabor(state);

  const outboundNodes = new Set<string>();
  forwardQueuedTokens(state, outboundNodes);

  for (const node of sortedNodes(state)) {
    if (outboundNodes.has(node.id)) continue;
    const plan = dispatchPlanFor(node);
    if (!plan) continue;
    if (node.stock[plan.resource] < 1) continue;

    const path = pathToNearest(state, node.id, plan.targetKind);
    if (!path) continue;
    if (!canEnterEdge(state, path[0])) continue;

    const id = `t${state.nextTokenId++}`;
    state.tokens[id] = {
      id,
      resource: plan.resource,
      state: "moving",
      at: path[0],
      progress: 0,
      destination: path.destination,
    };
    node.stock[plan.resource] -= 1;
    outboundNodes.add(node.id);
  }
}

export function consume(state: SimState): void {
  for (const node of Object.values(state.nodes)) {
    if (node.kind === "home" && state.tick % 8 === 0) {
      if (node.stock.food > 0) {
        node.stock.food -= 1;
        node.starving = false;
      } else {
        node.starving = true;
      }
    }

    if (node.kind === "workplace") {
      if (state.tick % 8 === 0 && node.stock.labor > 0) {
        node.stock.labor -= 1;
      }
      node.idleWorkers = node.powered ? Math.max(0, 2 - node.stock.labor) : 2;
    }
  }
}

function regenerateHomeLabor(state: SimState): void {
  if (state.tick % 8 !== 0) return;
  for (const node of Object.values(state.nodes)) {
    if (
      node.kind === "home" &&
      node.operational &&
      !node.starving &&
      node.stock.labor < node.capacity.labor
    ) {
      node.stock.labor += 1;
    }
  }
}

function forwardQueuedTokens(state: SimState, outboundNodes: Set<string>): void {
  for (const token of sortedQueuedTokens(state)) {
    const from = token.at;
    if (outboundNodes.has(from)) continue;
    if (!state.nodes[from]) {
      token.state = "stranded";
      token.progress = 0;
      continue;
    }

    const path = shortestRoadPath(state, from, token.destination);
    if (!path || path.length === 0) {
      token.state = "stranded";
      token.progress = 0;
      continue;
    }
    if (!canEnterEdge(state, path[0])) continue;

    token.state = "moving";
    token.at = path[0];
    token.progress = 0;
    outboundNodes.add(from);
  }
}

function sortedQueuedTokens(state: SimState): Token[] {
  return Object.values(state.tokens)
    .filter((token) => token.state === "queued")
    .sort((a, b) => a.id.localeCompare(b.id));
}

function sortedNodes(state: SimState): SimNode[] {
  return Object.values(state.nodes).sort((a, b) => a.id.localeCompare(b.id));
}

function dispatchPlanFor(node: SimNode): DispatchPlan | null {
  if (!node.operational) return null;

  switch (node.kind) {
    case "farm":
      if (!node.powered) return null;
      return { resource: "food", targetKind: "bakery" };
    case "bakery":
      if (!node.powered) return null;
      return { resource: "food", targetKind: "market" };
    case "market":
      return { resource: "food", targetKind: "home" };
    case "home":
      if (node.starving) return null;
      return { resource: "labor", targetKind: "workplace" };
    default:
      return null;
  }
}

function pathToNearest(
  state: SimState,
  from: string,
  targetKind: NodeKind,
): (string[] & { destination: string }) | null {
  let best: { destination: string; edges: string[] } | null = null;

  for (const candidate of sortedNodes(state)) {
    if (candidate.kind !== targetKind) continue;
    const edges = shortestRoadPath(state, from, candidate.id);
    if (!edges || edges.length === 0) continue;
    if (
      !best ||
      edges.length < best.edges.length ||
      (edges.length === best.edges.length &&
        candidate.id.localeCompare(best.destination) < 0)
    ) {
      best = { destination: candidate.id, edges };
    }
  }

  if (!best) return null;
  return Object.assign([...best.edges], { destination: best.destination });
}

function canEnterEdge(state: SimState, edgeId: string): boolean {
  const edge = state.edges[edgeId];
  return !!edge && countTokensOnEdge(state, edgeId) < edge.capacity;
}
