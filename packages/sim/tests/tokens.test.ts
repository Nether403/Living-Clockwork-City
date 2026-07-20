import { describe, expect, it } from "vitest";
import {
  advanceTokens,
  countTokensOnEdge,
  strandTokensAtNode,
  strandTokensOnEdge,
} from "../src/tokens";
import type { SimState, Token } from "../src/types";

function stateWithMovingToken(): SimState {
  const token: Token = {
    id: "t1",
    resource: "food",
    state: "moving",
    at: "r1",
    headingTo: "bakery",
    progress: 0,
    destination: "bakery",
  };
  return {
    tick: 0,
    nextTokenId: 2,
    demolished: [],
    nodes: {
      farm: {
        id: "farm",
        kind: "farm",
        name: "Farm",
        x: 0,
        z: 0,
        capacity: { food: 10, energy: 0, labor: 0, water: 0, waste: 0 },
        stock: { food: 0, energy: 0, labor: 0, water: 0, waste: 0 },
        powered: true,
        operational: true,
        starving: false,
        thirsty: false,
        clogged: false,
        idleWorkers: 0,
      },
      bakery: {
        id: "bakery",
        kind: "bakery",
        name: "Bakery",
        x: 4,
        z: 0,
        capacity: { food: 10, energy: 0, labor: 0, water: 0, waste: 0 },
        stock: { food: 0, energy: 0, labor: 0, water: 0, waste: 0 },
        powered: true,
        operational: true,
        starving: false,
        thirsty: false,
        clogged: false,
        idleWorkers: 0,
      },
    },
    edges: {
      r1: {
        id: "r1",
        from: "farm",
        to: "bakery",
        kind: "road",
        traversalTicks: 4,
        capacity: 2,
      },
    },
    tokens: { t1: token },
  };
}

describe("advanceTokens", () => {
  it("moves a token along an edge and delivers after enough ticks", () => {
    const state = stateWithMovingToken();
    for (let i = 0; i < 3; i++) advanceTokens(state);
    expect(state.tokens.t1.state).toBe("moving");
    expect(state.tokens.t1.progress).toBeCloseTo(0.75);
    advanceTokens(state);
    expect(state.tokens.t1.state).toBe("delivered");
    expect(state.tokens.t1.at).toBe("bakery");
    expect(state.nodes.bakery.stock.food).toBe(1);
  });

  it("delivers when traveling opposite the stored edge orientation", () => {
    const state = stateWithMovingToken();
    state.edges.r1.from = "bakery";
    state.edges.r1.to = "farm";

    for (let i = 0; i < 4; i++) advanceTokens(state);

    expect(state.tokens.t1.state).toBe("delivered");
    expect(state.tokens.t1.at).toBe("bakery");
    expect(state.nodes.bakery.stock.food).toBe(1);
  });

  it("strands a moving token when its edge is missing", () => {
    const state = stateWithMovingToken();
    delete state.edges.r1;
    advanceTokens(state);
    expect(state.tokens.t1.state).toBe("stranded");
  });

  it("queues at intermediate node when destination is further", () => {
    const state = stateWithMovingToken();
    state.tokens.t1.destination = "market";
    state.nodes.market = {
      id: "market",
      kind: "market",
      name: "Market",
      x: 8,
      z: 0,
      capacity: { food: 10, energy: 0, labor: 0, water: 0, waste: 0 },
      stock: { food: 0, energy: 0, labor: 0, water: 0, waste: 0 },
      powered: true,
      operational: true,
      starving: false,
      thirsty: false,
      clogged: false,
      idleWorkers: 0,
    };
    for (let i = 0; i < 4; i++) advanceTokens(state);
    expect(state.tokens.t1.state).toBe("queued");
    expect(state.tokens.t1.at).toBe("bakery");
    expect(state.tokens.t1.progress).toBe(0);
    expect(state.nodes.bakery.stock.food).toBe(0);
  });
});

describe("countTokensOnEdge", () => {
  it("counts only moving tokens on the given edge", () => {
    const state = stateWithMovingToken();
    expect(countTokensOnEdge(state, "r1")).toBe(1);
    state.tokens.t1.state = "queued";
    expect(countTokensOnEdge(state, "r1")).toBe(0);
  });
});

describe("strandTokensOnEdge", () => {
  it("marks in-flight tokens stranded when an edge is demolished", () => {
    const state = stateWithMovingToken();
    advanceTokens(state);
    strandTokensOnEdge(state, "r1");
    expect(state.tokens.t1.state).toBe("stranded");
  });
});

describe("strandTokensAtNode", () => {
  it("strands queued tokens at the node", () => {
    const state = stateWithMovingToken();
    state.tokens.t1.state = "queued";
    state.tokens.t1.at = "farm";
    strandTokensAtNode(state, "farm");
    expect(state.tokens.t1.state).toBe("stranded");
    expect(state.tokens.t1.at).toBe("farm");
    expect(state.tokens.t1.progress).toBe(0);
  });

  it("strands moving tokens whose edge touches the node", () => {
    const state = stateWithMovingToken();
    advanceTokens(state);
    strandTokensAtNode(state, "farm");
    expect(state.tokens.t1.state).toBe("stranded");
    expect(state.tokens.t1.at).toBe("farm");
  });
});
