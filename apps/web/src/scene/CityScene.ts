import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type {
  EdgeKind,
  FrameSnapshot,
  NodeKind,
  ResourceKind,
  SimEdge,
  SimNode,
  Token,
} from "@lcc/sim";

type SimKind = "node" | "edge" | "token";

interface NodeStyle {
  color: number;
  footprint: [number, number];
  height: number;
}

const NODE_STYLES: Record<NodeKind, NodeStyle> = {
  home: { color: 0xc8915a, footprint: [0.9, 0.8], height: 0.55 },
  farm: { color: 0x7f9f55, footprint: [1.35, 1.05], height: 0.16 },
  bakery: { color: 0xd49a55, footprint: [0.9, 0.9], height: 0.95 },
  market: { color: 0xbb7a48, footprint: [1.15, 0.95], height: 0.7 },
  workplace: { color: 0x6f8190, footprint: [1.15, 1], height: 0.8 },
  power_plant: { color: 0x8b7563, footprint: [1.25, 1.05], height: 0.9 },
  substation: { color: 0xa58f5d, footprint: [0.5, 0.5], height: 0.45 },
  junction: { color: 0x807461, footprint: [0.5, 0.5], height: 0.08 },
};

const EDGE_DIMENSIONS: Record<EdgeKind, { color: number; height: number; width: number; y: number }> = {
  road: { color: 0x3e352d, height: 0.07, width: 0.28, y: 0.035 },
  power: { color: 0xf0c960, height: 0.035, width: 0.075, y: 0.13 },
};

const TOKEN_Y = 0.42;
const UNPOWERED_MULTIPLIER = 0.35;

export class CityScene {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(48, 1, 0.1, 120);
  private readonly renderer = new WebGLRenderer({ antialias: true });
  private readonly controls: OrbitControls;
  private readonly nodeObjects = new Map<string, Object3D>();
  private readonly edgeObjects = new Map<string, Mesh>();
  private readonly tokenObjects = new Map<string, Object3D>();
  private readonly resizeObserver: ResizeObserver;
  private selectedId: string | null = null;

  constructor(private readonly container: HTMLElement) {
    this.scene.background = null;
    this.scene.fog = new Fog(0xd9cba9, 18, 48);

    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.append(this.renderer.domElement);

    this.camera.position.set(8, 12, 16);
    this.camera.lookAt(1, 0, 1);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(1, 0, 1);
    this.controls.maxPolarAngle = MathUtils.degToRad(72);
    this.controls.minDistance = 7;
    this.controls.maxDistance = 36;

    this.addEnvironment();
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get pickCamera(): PerspectiveCamera {
    return this.camera;
  }

  getPickableObjects(): Object3D[] {
    return [...this.nodeObjects.values(), ...this.edgeObjects.values()];
  }

  setSelection(selection: { id: string } | null): void {
    const nextSelectedId = selection?.id ?? null;
    if (nextSelectedId === this.selectedId) return;

    const previousSelectedId = this.selectedId;
    this.selectedId = nextSelectedId;

    if (previousSelectedId) this.applyHighlight(previousSelectedId, false);
    if (this.selectedId) this.applyHighlight(this.selectedId, true);
  }

  sync(snapshot: FrameSnapshot): void {
    const demolishedIds = new Set(snapshot.demolishedIds);
    const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
    const edgesById = new Map(snapshot.edges.map((edge) => [edge.id, edge]));
    const liveNodeIds = new Set(nodesById.keys());
    const liveEdgeIds = new Set(edgesById.keys());
    const liveTokenIds = new Set(snapshot.tokens.map((token) => token.id));

    this.removeMissing(this.nodeObjects, liveNodeIds, demolishedIds);
    this.removeMissing(this.edgeObjects, liveEdgeIds, demolishedIds);
    this.removeMissing(this.tokenObjects, liveTokenIds, demolishedIds);

    for (const edge of snapshot.edges) {
      const from = nodesById.get(edge.from);
      const to = nodesById.get(edge.to);
      if (!from || !to || demolishedIds.has(edge.id)) {
        this.removeObject(this.edgeObjects, edge.id);
        continue;
      }

      const object = this.edgeObjects.get(edge.id) ?? this.createEdgeObject(edge);
      this.edgeObjects.set(edge.id, object);
      if (!object.parent) this.scene.add(object);
      this.updateEdgeObject(object, edge, from, to);
    }

    for (const node of snapshot.nodes) {
      if (demolishedIds.has(node.id)) {
        this.removeObject(this.nodeObjects, node.id);
        continue;
      }

      const object = this.nodeObjects.get(node.id) ?? this.createNodeObject(node);
      this.nodeObjects.set(node.id, object);
      if (!object.parent) this.scene.add(object);
      object.position.set(node.x, 0, node.z);
      this.updateNodePower(object, node.powered);
    }

    for (const token of snapshot.tokens) {
      const position = this.resolveTokenPosition(token, nodesById, edgesById);
      if (!position) {
        this.removeObject(this.tokenObjects, token.id);
        continue;
      }

      const object =
        this.tokenObjects.get(token.id) ?? this.createTokenObject(token);
      this.tokenObjects.set(token.id, object);
      if (!object.parent) this.scene.add(object);
      object.position.copy(position);
      object.rotation.set(0, 0, token.state === "stranded" ? Math.PI / 2 : 0);
    }

    if (this.selectedId) {
      this.applyHighlight(this.selectedId, true);
    }
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.domElement.remove();
    this.disposeObject(this.scene);
    this.renderer.dispose();
  }

  private addEnvironment(): void {
    const ground = new Mesh(
      new PlaneGeometry(80, 80),
      new MeshStandardMaterial({
        color: 0xb7aa88,
        roughness: 1,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.015;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const hemisphere = new HemisphereLight(0xffe8bd, 0x6f694d, 2.2);
    this.scene.add(hemisphere);

    const sun = new DirectionalLight(0xffd89b, 2.8);
    sun.position.set(-8, 15, 11);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 42;
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    this.scene.add(sun);
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private createNodeObject(node: SimNode): Object3D {
    const group = new Group();
    stampPickData(group, node.id, "node");

    switch (node.kind) {
      case "farm":
        this.addFarm(group, node);
        break;
      case "market":
        this.addMarket(group, node);
        break;
      case "power_plant":
        this.addPowerPlant(group, node);
        break;
      case "substation":
        this.addSubstation(group, node);
        break;
      case "junction":
        this.addJunction(group, node);
        break;
      default:
        this.addBlock(group, node, NODE_STYLES[node.kind].color);
        break;
    }

    return group;
  }

  private addBlock(group: Group, node: SimNode, color: number): void {
    const style = NODE_STYLES[node.kind];
    const mesh = new Mesh(
      new BoxGeometry(style.footprint[0], style.height, style.footprint[1]),
      createMaterial(color),
    );
    mesh.position.y = style.height / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  private addFarm(group: Group, node: SimNode): void {
    this.addBlock(group, node, NODE_STYLES.farm.color);
    for (let i = -1; i <= 1; i += 1) {
      const row = new Mesh(
        new BoxGeometry(1.05, 0.035, 0.12),
        createMaterial(0x5f7f3f),
      );
      row.position.set(0, 0.21, i * 0.25);
      row.receiveShadow = true;
      group.add(row);
    }
  }

  private addMarket(group: Group, node: SimNode): void {
    this.addBlock(group, node, NODE_STYLES.market.color);
    const awning = new Mesh(
      new BoxGeometry(1.25, 0.12, 0.28),
      createMaterial(0xd9be77),
    );
    awning.position.set(0, NODE_STYLES.market.height + 0.09, -0.53);
    awning.castShadow = true;
    group.add(awning);
  }

  private addPowerPlant(group: Group, node: SimNode): void {
    this.addBlock(group, node, NODE_STYLES.power_plant.color);
    const chimney = new Mesh(
      new CylinderGeometry(0.15, 0.2, 1.2, 14),
      createMaterial(0x5d5046),
    );
    chimney.position.set(0.34, 1.12, 0.24);
    chimney.castShadow = true;
    group.add(chimney);
  }

  private addSubstation(group: Group, node: SimNode): void {
    this.addBlock(group, node, NODE_STYLES.substation.color);
    const pole = new Mesh(
      new CylinderGeometry(0.055, 0.075, 0.9, 10),
      createMaterial(0x594b3d),
    );
    pole.position.y = 0.82;
    pole.castShadow = true;
    group.add(pole);
  }

  private addJunction(group: Group, node: SimNode): void {
    const mesh = new Mesh(
      new CylinderGeometry(0.32, 0.38, NODE_STYLES.junction.height, 16),
      createMaterial(NODE_STYLES.junction.color),
    );
    mesh.position.y = NODE_STYLES.junction.height / 2;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  private updateNodePower(object: Object3D, powered: boolean): void {
    const multiplier = powered ? 1 : UNPOWERED_MULTIPLIER;
    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        const baseColor = material.userData.baseColor;
        if (baseColor instanceof Color) {
          material.color.copy(baseColor).multiplyScalar(multiplier);
        }
      }
    });
  }

  private createEdgeObject(edge: SimEdge): Mesh {
    const dimensions = EDGE_DIMENSIONS[edge.kind];
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), createMaterial(dimensions.color));
    mesh.castShadow = edge.kind === "road";
    mesh.receiveShadow = true;
    stampPickData(mesh, edge.id, "edge");
    return mesh;
  }

  private updateEdgeObject(
    mesh: Mesh,
    edge: SimEdge,
    from: SimNode,
    to: SimNode,
  ): void {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    const dimensions = EDGE_DIMENSIONS[edge.kind];

    mesh.visible = length > 0.001;
    mesh.position.set(from.x + dx / 2, dimensions.y, from.z + dz / 2);
    mesh.rotation.set(0, -Math.atan2(dz, dx), 0);
    mesh.scale.set(Math.max(length, 0.001), dimensions.height, dimensions.width);
  }

  private createTokenObject(token: Token): Object3D {
    const group = new Group();
    stampPickData(group, token.id, "token");

    switch (token.resource) {
      case "food":
        group.add(createFoodToken());
        break;
      case "energy":
        group.add(createEnergyToken());
        break;
      case "labor":
        group.add(createLaborToken());
        break;
    }

    stampPickData(group, token.id, "token");
    return group;
  }

  private resolveTokenPosition(
    token: Token,
    nodesById: ReadonlyMap<string, SimNode>,
    edgesById: ReadonlyMap<string, SimEdge>,
  ): Vector3 | null {
    if (token.state === "moving") {
      const edge = edgesById.get(token.at);
      if (!edge) return null;
      const end = nodesById.get(token.headingTo);
      const startId = edge.to === token.headingTo ? edge.from : edge.to;
      const start = nodesById.get(startId);
      if (!start || !end) return null;
      return nodePosition(start).lerp(nodePosition(end), clampProgress(token.progress));
    }

    const node = nodesById.get(token.at);
    if (node) return nodePosition(node).add(tokenPadOffset(token));

    const edge = edgesById.get(token.at);
    if (token.state === "stranded" && edge) {
      const from = nodesById.get(edge.from);
      const to = nodesById.get(edge.to);
      if (from && to) {
        return nodePosition(from).lerp(nodePosition(to), 0.5);
      }
    }

    const headingNode = nodesById.get(token.headingTo);
    return headingNode ? nodePosition(headingNode).add(tokenPadOffset(token)) : null;
  }

  private removeMissing<T extends Object3D>(
    objects: Map<string, T>,
    liveIds: ReadonlySet<string>,
    demolishedIds: ReadonlySet<string>,
  ): void {
    for (const id of objects.keys()) {
      if (!liveIds.has(id) || demolishedIds.has(id)) {
        this.removeObject(objects, id);
      }
    }
  }

  private removeObject<T extends Object3D>(objects: Map<string, T>, id: string): void {
    const object = objects.get(id);
    if (!object) return;
    if (id === this.selectedId) this.applyHighlight(id, false);
    object.removeFromParent();
    this.disposeObject(object);
    objects.delete(id);
  }

  private applyHighlight(id: string, active: boolean): void {
    const object = this.nodeObjects.get(id) ?? this.edgeObjects.get(id);
    if (!object) return;

    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        if (active) {
          material.emissive.set(0xffa047);
          material.emissiveIntensity = 0.28;
          continue;
        }

        const baseEmissive = material.userData.baseEmissive;
        if (baseEmissive instanceof Color) {
          material.emissive.copy(baseEmissive);
        } else {
          material.emissive.set(0x000000);
        }
        material.emissiveIntensity =
          typeof material.userData.baseEmissiveIntensity === "number"
            ? material.userData.baseEmissiveIntensity
            : 1;
      }
    });
  }

  private disposeObject(object: Object3D): void {
    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) {
        material.dispose();
      }
    });
  }
}

function createFoodToken(): Object3D {
  const mesh = new Mesh(
    new BoxGeometry(0.34, 0.24, 0.28),
    createMaterial(0xb9793f),
  );
  mesh.position.y = 0.12;
  mesh.castShadow = true;
  return mesh;
}

function createEnergyToken(): Object3D {
  const group = new Group();
  const body = new Mesh(
    new CylinderGeometry(0.15, 0.15, 0.34, 14),
    createMaterial(0xd2b950),
  );
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.16;
  body.castShadow = true;
  group.add(body);

  const nub = new Mesh(
    new CylinderGeometry(0.08, 0.08, 0.08, 10),
    createMaterial(0xf0d875),
  );
  nub.rotation.z = Math.PI / 2;
  nub.position.set(0.2, 0.16, 0);
  nub.castShadow = true;
  group.add(nub);
  return group;
}

function createLaborToken(): Object3D {
  const group = new Group();
  const body = new Mesh(
    new CylinderGeometry(0.09, 0.12, 0.28, 10),
    createMaterial(0x4d6172),
  );
  body.position.y = 0.18;
  body.castShadow = true;
  group.add(body);

  const head = new Mesh(new SphereGeometry(0.11, 12, 8), createMaterial(0xc6956e));
  head.position.y = 0.4;
  head.castShadow = true;
  group.add(head);
  return group;
}

function createMaterial(color: number): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color,
    roughness: 0.86,
    metalness: 0.04,
  });
  material.userData.baseColor = material.color.clone();
  material.userData.baseEmissive = material.emissive.clone();
  material.userData.baseEmissiveIntensity = material.emissiveIntensity;
  return material;
}

function stampPickData(object: Object3D, simId: string, simKind: SimKind): void {
  object.userData.simId = simId;
  object.userData.simKind = simKind;
  object.traverse((child) => {
    child.userData.simId = simId;
    child.userData.simKind = simKind;
  });
}

function nodePosition(node: SimNode): Vector3 {
  return new Vector3(node.x, TOKEN_Y, node.z);
}

function clampProgress(progress: number): number {
  return MathUtils.clamp(progress, 0, 1);
}

function tokenPadOffset(token: Token): Vector3 {
  const hash = hashString(token.id);
  const angle = (hash % 360) * MathUtils.DEG2RAD;
  const radiusByResource: Record<ResourceKind, number> = {
    food: 0.38,
    energy: 0.46,
    labor: 0.54,
  };
  const radius = radiusByResource[token.resource] + ((hash >> 4) % 3) * 0.045;
  return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
