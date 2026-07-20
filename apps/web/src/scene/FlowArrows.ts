import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import {
  shortestPipePath,
  shortestRoadPath,
  type FrameSnapshot,
  type NodeKind,
  type SimEdge,
  type SimNode,
  type SimState,
} from "@lcc/sim";
import type { PickSelection } from "../input/Picker";

const ROUTE_TARGETS: Partial<Record<NodeKind, NodeKind>> = {
  farm: "bakery",
  bakery: "market",
  market: "home",
  home: "workplace",
  reservoir: "bakery",
};

const ARROW_Y = 0.34;
const POWER_ARROW_Y = 0.48;
const PIPE_ARROW_Y = 0.4;
const EDGE_HIGHLIGHT_Y = 0.5;
const UP = new Vector3(0, 1, 0);

export class FlowArrows {
  readonly group = new Group();

  private readonly shaftGeometry = new CylinderGeometry(1, 1, 1, 8);
  private readonly coneGeometry = new ConeGeometry(1, 1, 14);
  private readonly routeMaterial = new MeshBasicMaterial({
    color: 0xd79a47,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
  });
  private readonly highlightMaterial = new MeshBasicMaterial({
    color: 0xffc45f,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  sync(snapshot: FrameSnapshot, selection: PickSelection | null): void {
    this.clear();
    if (!selection) return;

    const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
    const edgesById = new Map(snapshot.edges.map((edge) => [edge.id, edge]));

    if (selection.kind === "edge") {
      const edge = edgesById.get(selection.id);
      if (!edge) return;
      this.drawEdgeArrow(edge, edge.from, edge.to, nodesById, true);
      return;
    }

    const node = nodesById.get(selection.id);
    if (!node) return;

    if (node.kind === "power_plant" || node.kind === "substation") {
      for (const edge of snapshot.edges) {
        if (
          edge.kind === "power" &&
          (edge.from === node.id || edge.to === node.id)
        ) {
          const toNodeId = edge.from === node.id ? edge.to : edge.from;
          this.drawEdgeArrow(edge, node.id, toNodeId, nodesById, false);
        }
      }
      return;
    }

    const targetKind = ROUTE_TARGETS[node.kind];
    if (!targetKind) return;

    const state = snapshotToState(snapshot);
    const path = nearestPathToKind(
      state,
      node.id,
      targetKind,
      node.kind === "reservoir" ? "pipe" : "road",
    );
    if (!path) return;

    let fromNodeId = node.id;
    for (const edgeId of path) {
      const edge = edgesById.get(edgeId);
      if (!edge) break;
      const toNodeId = otherEndpoint(edge, fromNodeId);
      if (!toNodeId) break;
      this.drawEdgeArrow(edge, fromNodeId, toNodeId, nodesById, false);
      fromNodeId = toNodeId;
    }
  }

  dispose(): void {
    this.clear();
    this.shaftGeometry.dispose();
    this.coneGeometry.dispose();
    this.routeMaterial.dispose();
    this.highlightMaterial.dispose();
  }

  private clear(): void {
    this.group.clear();
  }

  private drawEdgeArrow(
    edge: SimEdge,
    fromNodeId: string,
    toNodeId: string,
    nodesById: ReadonlyMap<string, SimNode>,
    highlighted: boolean,
  ): void {
    const from = nodesById.get(fromNodeId);
    const to = nodesById.get(toNodeId);
    if (!from || !to) return;

    const y = highlighted
      ? EDGE_HIGHLIGHT_Y
      : edge.kind === "power"
        ? POWER_ARROW_Y
        : edge.kind === "pipe"
          ? PIPE_ARROW_Y
          : ARROW_Y;
    const start = new Vector3(from.x, y, from.z);
    const end = new Vector3(to.x, y, to.z);
    const delta = end.clone().sub(start);
    const length = delta.length();
    if (length < 0.25) return;

    const direction = delta.normalize();
    const pad = Math.min(0.42, length * 0.18);
    const headLength = MathUtils.clamp(length * 0.18, 0.22, 0.42);
    const shaftLength = Math.max(0.12, length - pad * 2 - headLength);
    const radius = highlighted ? 0.055 : edge.kind === "power" ? 0.035 : 0.042;
    const headRadius = highlighted ? 0.16 : edge.kind === "power" ? 0.105 : 0.13;

    const arrow = new Group();
    arrow.position.copy(start).addScaledVector(direction, pad);
    arrow.quaternion.copy(new Quaternion().setFromUnitVectors(UP, direction));

    const material = highlighted ? this.highlightMaterial : this.routeMaterial;
    const shaft = new Mesh(this.shaftGeometry, material);
    shaft.scale.set(radius, shaftLength, radius);
    shaft.position.y = shaftLength / 2;
    arrow.add(shaft);

    const cone = new Mesh(this.coneGeometry, material);
    cone.scale.set(headRadius, headLength, headRadius);
    cone.position.y = shaftLength + headLength / 2;
    arrow.add(cone);

    this.group.add(arrow);
  }
}

function snapshotToState(snapshot: FrameSnapshot): SimState {
  return {
    tick: snapshot.tick,
    nodes: Object.fromEntries(snapshot.nodes.map((node) => [node.id, node])),
    edges: Object.fromEntries(snapshot.edges.map((edge) => [edge.id, edge])),
    tokens: Object.fromEntries(snapshot.tokens.map((token) => [token.id, token])),
    demolished: [],
    nextTokenId: 0,
  };
}

function nearestPathToKind(
  state: SimState,
  fromNodeId: string,
  targetKind: NodeKind,
  edgeKind: "road" | "pipe" = "road",
): string[] | null {
  let best: { destination: string; edges: string[] } | null = null;
  const findPath = edgeKind === "pipe" ? shortestPipePath : shortestRoadPath;

  const candidates = Object.values(state.nodes)
    .filter((node) => node.kind === targetKind && node.id !== fromNodeId)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const candidate of candidates) {
    const edges = findPath(state, fromNodeId, candidate.id);
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

  return best?.edges ?? null;
}

function otherEndpoint(edge: SimEdge, fromNodeId: string): string | null {
  if (edge.from === fromNodeId) return edge.to;
  if (edge.to === fromNodeId) return edge.from;
  return null;
}
