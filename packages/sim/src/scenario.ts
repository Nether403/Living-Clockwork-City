import { z } from "zod";
import type { Simulation } from "./simulation.js";
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

export interface ScenarioIndex {
  scenarios: string[];
}

export interface CaptionRule {
  id: string;
  when: CaptionPredicate;
  text: string;
}

export interface ScenarioRuntimeState {
  def: ScenarioDef;
  warmUpRemaining: number;
  followUpRemaining: number | null;
  firedCaptions: Set<string>;
  autoDemolishDone: boolean;
  followUpDone: boolean;
}

export type CaptionPredicate =
  | {
      type: "node_flag";
      nodeId: string;
      flag: "starving" | "unpowered" | "idle_workers" | "thirsty" | "clogged";
      minIdle?: number;
    }
  | { type: "any_home_starving" }
  | { type: "any_home_clogged" }
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
        flag: z.enum([
          "starving",
          "unpowered",
          "idle_workers",
          "thirsty",
          "clogged",
        ]),
        minIdle: z.number().int().nonnegative().optional(),
      })
      .strict(),
    z.object({ type: z.literal("any_home_starving") }).strict(),
    z.object({ type: z.literal("any_home_clogged") }).strict(),
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

const scenarioIndexSchema: z.ZodType<ScenarioIndex> = z
  .object({
    scenarios: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((index, ctx) => {
    const scenarioIds = new Set<string>();
    for (const scenarioId of index.scenarios) {
      if (scenarioIds.has(scenarioId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate scenario id: ${scenarioId}`,
          path: ["scenarios"],
        });
      }
      scenarioIds.add(scenarioId);
    }
  });

export function loadScenarioIndex(json: unknown): ScenarioIndex {
  return scenarioIndexSchema.parse(json);
}

export function createScenarioRuntime(def: ScenarioDef): ScenarioRuntimeState {
  return {
    def,
    warmUpRemaining: def.warmUpTicks,
    followUpRemaining: null,
    firedCaptions: new Set(),
    autoDemolishDone: false,
    followUpDone: false,
  };
}

export function advanceScenario(
  state: ScenarioRuntimeState,
  sim: Simulation,
  snapshot: FrameSnapshot,
): { captions: { id: string; text: string }[]; didDemolish: boolean } {
  const captions = collectNewCaptions(state, snapshot);
  let didDemolish = false;
  const { def } = state;

  if (!state.autoDemolishDone && def.autoDemolishId) {
    if (state.warmUpRemaining > 0) {
      state.warmUpRemaining -= 1;
    } else {
      const postDemolishSnapshot = sim.demolish(def.autoDemolishId);
      state.autoDemolishDone = true;
      didDemolish = true;
      if (def.followUp) {
        state.followUpRemaining = def.followUp.afterTicks;
      }
      captions.push(...collectNewCaptions(state, postDemolishSnapshot));
    }
  } else if (state.followUpRemaining !== null && !state.followUpDone) {
    if (state.followUpRemaining > 0) {
      state.followUpRemaining -= 1;
    } else if (def.followUp) {
      const postDemolishSnapshot = sim.demolish(def.followUp.demolishId);
      state.followUpDone = true;
      state.followUpRemaining = null;
      didDemolish = true;
      captions.push(...collectNewCaptions(state, postDemolishSnapshot));
    }
  }

  return { captions, didDemolish };
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

function collectNewCaptions(
  state: ScenarioRuntimeState,
  snapshot: FrameSnapshot,
): { id: string; text: string }[] {
  const captions = evaluateCaptions(
    snapshot,
    state.def.captions,
    state.firedCaptions,
  );
  for (const caption of captions) {
    state.firedCaptions.add(caption.id);
  }
  return captions;
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
    case "any_home_clogged":
      return snapshot.nodes.some(
        (node) => node.kind === "home" && node.clogged,
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
    case "thirsty":
      return node.thirsty;
    case "clogged":
      return node.clogged;
  }
}

function findNode(
  snapshot: FrameSnapshot,
  nodeId: string,
): SimNode | undefined {
  return snapshot.nodes.find((node) => node.id === nodeId);
}
