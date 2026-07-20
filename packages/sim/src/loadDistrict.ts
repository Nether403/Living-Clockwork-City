import { z } from "zod";
import type { EdgeKind, NodeKind, SimEdge, SimNode, SimState, StockPile } from "./types.js";

const stockSchema = z
  .object({
    food: z.number().int().nonnegative(),
    energy: z.number().int().nonnegative(),
    labor: z.number().int().nonnegative(),
  })
  .strict();

const nodeKindSchema = z.enum([
  "home",
  "farm",
  "bakery",
  "market",
  "workplace",
  "power_plant",
  "substation",
  "junction",
]);

const edgeKindSchema = z.enum(["road", "power"]);

const nodeSchema = z
  .object({
    id: z.string().min(1),
    kind: nodeKindSchema,
    name: z.string().min(1),
    x: z.number(),
    z: z.number(),
    capacity: stockSchema,
    stock: stockSchema,
  })
  .strict();

const edgeSchema = z
  .object({
    id: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    kind: edgeKindSchema,
    traversalTicks: z.number().int().positive(),
    capacity: z.number().int().positive(),
  })
  .strict();

const districtSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    nodes: z.array(nodeSchema).min(1),
    edges: z.array(edgeSchema),
  })
  .strict()
  .superRefine((district, ctx) => {
    const nodeIds = new Set<string>();
    for (const node of district.nodes) {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate node id: ${node.id}`,
          path: ["nodes"],
        });
      }
      nodeIds.add(node.id);
    }

    const edgeIds = new Set<string>();
    for (const edge of district.edges) {
      if (edgeIds.has(edge.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate edge id: ${edge.id}`,
          path: ["edges"],
        });
      }
      edgeIds.add(edge.id);

      if (!nodeIds.has(edge.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown edge endpoint: ${edge.from}`,
          path: ["edges", edge.id, "from"],
        });
      }
      if (!nodeIds.has(edge.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown edge endpoint: ${edge.to}`,
          path: ["edges", edge.id, "to"],
        });
      }
    }
  });

type DistrictContent = z.infer<typeof districtSchema>;
type DistrictNodeContent = DistrictContent["nodes"][number];
type DistrictEdgeContent = DistrictContent["edges"][number];

export function loadDistrict(json: unknown): SimState {
  const district = districtSchema.parse(json);

  return {
    tick: 0,
    nodes: Object.fromEntries(
      district.nodes.map((node) => [node.id, toSimNode(node)]),
    ),
    edges: Object.fromEntries(
      district.edges.map((edge) => [edge.id, toSimEdge(edge)]),
    ),
    tokens: {},
    demolished: [],
    nextTokenId: 1,
  };
}

function toSimNode(node: DistrictNodeContent): SimNode {
  return {
    ...node,
    kind: node.kind as NodeKind,
    capacity: toStock(node.capacity),
    stock: toStock(node.stock),
    powered: false,
    operational: true,
    starving: false,
    idleWorkers: 0,
  };
}

function toSimEdge(edge: DistrictEdgeContent): SimEdge {
  return {
    ...edge,
    kind: edge.kind as EdgeKind,
  };
}

function toStock(stock: StockPile): StockPile {
  return { food: stock.food, energy: stock.energy, labor: stock.labor };
}
