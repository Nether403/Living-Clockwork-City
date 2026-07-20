import { z } from "zod";
import type { FrameSnapshot, SimNode } from "./types.js";

export interface ScenarioDef {
  id: string;
  title: string;
  blurb: string;
  districtId: string;
  camera?: {
    x: number;
    y: number;
    z: number;
    targetX: number;
    targetZ: number;
  };
  warmUpTicks: number;
  autoDemolishId?: string;
  followUp?: { afterTicks: number; demolishId: string };
  captions: CaptionRule[];
}

export interface CaptionRule {
  id: string;
  when: CaptionPredicate;
  text: string;
}

export type CaptionPredicate =
  | {
      type: "node_flag";
      nodeId: string;
      flag: "starving" | "unpowered" | "idle_workers";
      minIdle?: number;
    }
  | { type: "any_home_starving" }
  | { type: "node_unpowered"; nodeId: string }
  | { type: "demolished"; id: string };

const cameraSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    targetX: z.number(),
    targetZ: z.number(),
  })
  .strict();

const captionPredicateSchema: z.ZodType<CaptionPredicate> = z.discriminatedUnion(
  "type",
  [
    z
      .object({
        type: z.literal("node_flag"),
        nodeId: z.string().min(1),
        flag: z.enum(["starving", "unpowered", "idle_workers"]),
        minIdle: z.number().int().nonnegative().optional(),
      })
      .strict(),
    z.object({ type: z.literal("any_home_starving") }).strict(),
    z
      .object({
        type: z.literal("node_unpowered"),
        nodeId: z.string().min(1),
      })
      .strict(),
    z
      .object({
        type: z.literal("demolished"),
        id: z.string().min(1),
      })
      .strict(),
  ],
);

const captionRuleSchema = z
  .object({
    id: z.string().min(1),
    when: captionPredicateSchema,
    text: z.string().min(1),
  })
  .strict();

const scenarioSchema: z.ZodType<ScenarioDef> = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    blurb: z.string().min(1),
    districtId: z.string().min(1),
    camera: cameraSchema.optional(),
    warmUpTicks: z.number().int().nonnegative(),
    autoDemolishId: z.string().min(1).optional(),
    followUp: z
      .object({
        afterTicks: z.number().int().nonnegative(),
        demolishId: z.string().min(1),
      })
      .strict()
      .optional(),
    captions: z.array(captionRuleSchema),
  })
  .strict()
  .superRefine((scenario, ctx) => {
    const captionIds = new Set<string>();
    for (const caption of scenario.captions) {
      if (captionIds.has(caption.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate caption id: ${caption.id}`,
          path: ["captions"],
        });
      }
      captionIds.add(caption.id);
    }
  });

export function loadScenario(json: unknown): ScenarioDef {
  return scenarioSchema.parse(json);
}

export function evaluateCaptions(
  snapshot: FrameSnapshot,
  rules: readonly CaptionRule[],
  fired: ReadonlySet<string>,
): { id: string; text: string }[] {
  return rules
    .filter(
      (rule) => !fired.has(rule.id) && matchesPredicate(snapshot, rule.when),
    )
    .map((rule) => ({ id: rule.id, text: rule.text }));
}

function matchesPredicate(
  snapshot: FrameSnapshot,
  predicate: CaptionPredicate,
): boolean {
  switch (predicate.type) {
    case "node_flag": {
      const node = findNode(snapshot, predicate.nodeId);
      if (!node) return false;
      return matchesNodeFlag(node, predicate);
    }
    case "any_home_starving":
      return snapshot.nodes.some(
        (node) => node.kind === "home" && node.starving,
      );
    case "node_unpowered": {
      const node = findNode(snapshot, predicate.nodeId);
      return node ? !node.powered : false;
    }
    case "demolished":
      return snapshot.demolishedIds.includes(predicate.id);
  }
}

function matchesNodeFlag(
  node: SimNode,
  predicate: Extract<CaptionPredicate, { type: "node_flag" }>,
): boolean {
  switch (predicate.flag) {
    case "starving":
      return node.starving;
    case "unpowered":
      return !node.powered;
    case "idle_workers":
      return node.idleWorkers >= (predicate.minIdle ?? 1);
  }
}

function findNode(
  snapshot: FrameSnapshot,
  nodeId: string,
): SimNode | undefined {
  return snapshot.nodes.find((node) => node.id === nodeId);
}
