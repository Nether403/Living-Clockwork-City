import type { SimEdge, SimState } from "./types.js";

function roadEdges(state: SimState): SimEdge[] {
  return Object.values(state.edges).filter((e) => e.kind === "road");
}

function powerEdges(state: SimState): SimEdge[] {
  return Object.values(state.edges).filter((e) => e.kind === "power");
}

/** Undirected adjacency for traversal (MVP roads/power are bidirectional). */
function undirectedAdj(
  edges: SimEdge[],
  kindFilter?: (e: SimEdge) => boolean,
): Map<string, { other: string; edgeId: string }[]> {
  const adj = new Map<string, { other: string; edgeId: string }[]>();
  for (const e of edges) {
    if (kindFilter && !kindFilter(e)) continue;
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push({ other: e.to, edgeId: e.id });
    adj.get(e.to)!.push({ other: e.from, edgeId: e.id });
  }
  return adj;
}

export function getRoadNeighbors(state: SimState, nodeId: string): string[] {
  const adj = undirectedAdj(roadEdges(state));
  return (adj.get(nodeId) ?? []).map((x) => x.other);
}

export function getPowerReachable(state: SimState): Set<string> {
  const plants = Object.values(state.nodes).filter(
    (n) => n.kind === "power_plant" && n.operational,
  );
  const adj = undirectedAdj(powerEdges(state));
  const reachable = new Set<string>();
  const stack = plants.map((p) => p.id);
  for (const id of stack) reachable.add(id);
  while (stack.length) {
    const cur = stack.pop()!;
    for (const next of adj.get(cur) ?? []) {
      if (!reachable.has(next.other) && state.nodes[next.other]) {
        reachable.add(next.other);
        stack.push(next.other);
      }
    }
  }
  return reachable;
}

export function shortestRoadPath(
  state: SimState,
  from: string,
  to: string,
): string[] | null {
  if (from === to) return [];
  const adj = undirectedAdj(roadEdges(state));
  const queue = [from];
  const prev = new Map<string, { node: string; edgeId: string }>();
  const seen = new Set<string>([from]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of adj.get(cur) ?? []) {
      if (seen.has(n.other)) continue;
      seen.add(n.other);
      prev.set(n.other, { node: cur, edgeId: n.edgeId });
      if (n.other === to) {
        const edges: string[] = [];
        let walk: string | undefined = to;
        while (walk && walk !== from) {
          const p: { node: string; edgeId: string } = prev.get(walk)!;
          edges.push(p.edgeId);
          walk = p.node;
        }
        return edges.reverse();
      }
      queue.push(n.other);
    }
  }
  return null;
}
