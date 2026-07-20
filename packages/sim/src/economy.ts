import {
  getPowerReachable,
  shortestPipePath,
  shortestRoadPath,
} from "./graph.js";
import { countTokensOnEdge } from "./tokens.js";
import type {
  EdgeKind,
  NodeKind,
  ResourceKind,
  SimNode,
  SimState,
  Token,
} from "./types.js";

type DispatchPlan = {
  resource: ResourceKind;
  targetKinds: NodeKind[];
  edgeKind: "road" | "pipe";
  consumeWater?: boolean;
};

export function updatePowerFlags(state: SimState): void {
  const powered = getPowerReachable(state);
  for (const node of Object.values(state.nodes)) {
    if (node.kind === "power_plant" && node.operational) {
      node.powered = true;
    } else if (node.kind === "reservoir" || node.kind === "dump") {
      node.powered = true;
    } else {
      node.powered = powered.has(node.id);
    }
  }
}

export function produce(state: SimState): void {
  for (const node of Object.values(state.nodes)) {
    if (!node.operational) continue;
    if (node.kind === "farm" && node.powered && state.tick % 4 === 0) {
      if (node.stock.food < node.capacity.food) {
        node.stock.food += 1;
      }
    }
    if (node.kind === "reservoir" && state.tick % 4 === 0) {
      if (node.stock.water < node.capacity.water) {
        node.stock.water += 1;
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
    if (plan.consumeWater && node.stock.water < 1) continue;

    const path = pathToNearest(state, node.id, plan.targetKinds, plan.edgeKind);
    if (!path) continue;
    const headingTo = otherEndpoint(state, path[0], node.id);
    if (!headingTo) continue;
    if (!canEnterEdge(state, path[0])) continue;

    const id = `t${state.nextTokenId++}`;
    state.tokens[id] = {
      id,
      resource: plan.resource,
      state: "moving",
      at: path[0],
      headingTo,
      progress: 0,
      destination: path.destination,
    };
    node.stock[plan.resource] -= 1;
    if (plan.consumeWater) {
      node.stock.water -= 1;
    }
    outboundNodes.add(node.id);
  }
}

export function consume(state: SimState): void {
  for (const node of Object.values(state.nodes)) {
    if (node.kind === "home" && state.tick % 8 === 0) {
      if (node.stock.food > 0) {
        node.stock.food -= 1;
        node.starving = false;
        if (node.stock.waste < node.capacity.waste) {
          node.stock.waste += 1;
        }
      } else {
        node.starving = true;
      }

      if (node.capacity.water > 0) {
        if (node.stock.water > 0) {
          node.stock.water -= 1;
          node.thirsty = false;
        } else {
          node.thirsty = true;
        }
      } else {
        node.thirsty = false;
      }
    }

    if (node.kind === "bakery") {
      node.thirsty =
        node.operational && node.powered && node.stock.water < 1;
    }

    if (node.kind === "home") {
      node.clogged =
        node.capacity.waste > 0 && node.stock.waste >= node.capacity.waste;
    }

    if (node.kind === "dump" && node.stock.waste > 0) {
      node.stock.waste -= 1;
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
      !node.clogged &&
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

    const path = pathForToken(state, from, token);
    if (!path || path.length === 0) {
      token.state = "stranded";
      token.progress = 0;
      continue;
    }
    if (!canEnterEdge(state, path[0])) continue;
    const headingTo = otherEndpoint(state, path[0], from);
    if (!headingTo) {
      token.state = "stranded";
      token.progress = 0;
      continue;
    }

    token.state = "moving";
    token.at = path[0];
    token.headingTo = headingTo;
    token.progress = 0;
    outboundNodes.add(from);
  }
}

function pathForToken(
  state: SimState,
  from: string,
  token: Token,
): string[] | null {
  if (token.resource === "water") {
    return shortestPipePath(state, from, token.destination);
  }
  return shortestRoadPath(state, from, token.destination);
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
      return { resource: "food", targetKinds: ["bakery"], edgeKind: "road" };
    case "bakery":
      if (!node.powered) return null;
      if (node.stock.water < 1) return null;
      return {
        resource: "food",
        targetKinds: ["market"],
        edgeKind: "road",
        consumeWater: true,
      };
    case "market":
      return { resource: "food", targetKinds: ["home"], edgeKind: "road" };
    case "home": {
      const wastePressure =
        node.capacity.waste > 0 &&
        node.stock.waste > Math.floor(node.capacity.waste / 2);
      if (node.clogged || wastePressure) {
        if (node.stock.waste < 1) return null;
        return { resource: "waste", targetKinds: ["dump"], edgeKind: "road" };
      }
      if (!node.starving && node.stock.labor >= 1) {
        return {
          resource: "labor",
          targetKinds: ["workplace"],
          edgeKind: "road",
        };
      }
      if (node.stock.waste > 0) {
        return { resource: "waste", targetKinds: ["dump"], edgeKind: "road" };
      }
      if (node.starving) return null;
      return {
        resource: "labor",
        targetKinds: ["workplace"],
        edgeKind: "road",
      };
    }
    case "reservoir":
      return {
        resource: "water",
        targetKinds: ["bakery", "home"],
        edgeKind: "pipe",
      };
    default:
      return null;
  }
}

function pathToNearest(
  state: SimState,
  from: string,
  targetKinds: NodeKind[],
  edgeKind: Extract<EdgeKind, "road" | "pipe">,
): (string[] & { destination: string }) | null {
  let best: { destination: string; edges: string[]; kindRank: number } | null =
    null;
  const findPath = edgeKind === "pipe" ? shortestPipePath : shortestRoadPath;

  for (const candidate of sortedNodes(state)) {
    const kindRank = targetKinds.indexOf(candidate.kind);
    if (kindRank < 0) continue;
    if (
      edgeKind === "pipe" &&
      candidate.stock.water >= candidate.capacity.water
    ) {
      continue;
    }
    if (
      edgeKind === "road" &&
      targetKinds.includes("dump") &&
      candidate.kind === "dump" &&
      candidate.stock.waste >= candidate.capacity.waste
    ) {
      continue;
    }
    const edges = findPath(state, from, candidate.id);
    if (!edges || edges.length === 0) continue;
    if (
      !best ||
      edges.length < best.edges.length ||
      (edges.length === best.edges.length && kindRank < best.kindRank) ||
      (edges.length === best.edges.length &&
        kindRank === best.kindRank &&
        candidate.id.localeCompare(best.destination) < 0)
    ) {
      best = { destination: candidate.id, edges, kindRank };
    }
  }

  if (!best) return null;
  return Object.assign([...best.edges], { destination: best.destination });
}

function canEnterEdge(state: SimState, edgeId: string): boolean {
  const edge = state.edges[edgeId];
  return !!edge && countTokensOnEdge(state, edgeId) < edge.capacity;
}

function otherEndpoint(
  state: SimState,
  edgeId: string,
  fromNodeId: string,
): string | null {
  const edge = state.edges[edgeId];
  if (!edge) return null;
  if (edge.from === fromNodeId) return edge.to;
  if (edge.to === fromNodeId) return edge.from;
  return null;
}
