import { describe, expect, it } from "vitest";
import { consume, dispatch, produce, updatePowerFlags } from "../src/economy";
import { advanceTokens } from "../src/tokens";
import type { NodeKind, SimNode, SimState, StockPile } from "../src/types";

function stock(
  food = 0,
  energy = 0,
  labor = 0,
  water = 0,
  waste = 0,
): StockPile {
  return { food, energy, labor, water, waste };
}

function node(
  id: string,
  kind: NodeKind,
  options: Partial<
    Pick<SimNode, "capacity" | "stock" | "powered" | "starving" | "clogged">
  > = {},
): SimNode {
  return {
    id,
    kind,
    name: id,
    x: 0,
    z: 0,
    capacity: options.capacity ?? stock(10, 0, 10),
    stock: options.stock ?? stock(),
    powered: options.powered ?? false,
    operational: true,
    starving: options.starving ?? false,
    thirsty: false,
    clogged: options.clogged ?? false,
    idleWorkers: 0,
  };
}

function buildMiniChain(): SimState {
  return {
    tick: 0,
    nextTokenId: 1,
    tokens: {},
    demolished: [],
    nodes: {
      plant: node("plant", "power_plant", { powered: true }),
      sub: node("sub", "substation"),
      farm: node("farm", "farm", {
        capacity: stock(10, 0, 0),
        stock: stock(5, 0, 0),
      }),
      bakery: node("bakery", "bakery", {
        capacity: stock(10, 0, 0, 10),
        stock: stock(0, 0, 0, 8),
      }),
      market: node("market", "market", { capacity: stock(10, 0, 0) }),
      home: node("home", "home", {
        capacity: stock(10, 0, 10, 0, 8),
        stock: stock(2, 0, 1),
      }),
      workplace: node("workplace", "workplace", {
        capacity: stock(0, 0, 10),
        stock: stock(0, 0, 0),
      }),
      reservoir: node("reservoir", "reservoir", {
        capacity: stock(0, 0, 0, 12),
        stock: stock(0, 0, 0, 6),
      }),
      dump: node("dump", "dump", {
        capacity: stock(0, 0, 0, 0, 40),
        stock: stock(),
      }),
    },
    edges: {
      power_sub: {
        id: "power_sub",
        from: "plant",
        to: "sub",
        kind: "power",
        traversalTicks: 1,
        capacity: 99,
      },
      power_farm: {
        id: "power_farm",
        from: "sub",
        to: "farm",
        kind: "power",
        traversalTicks: 1,
        capacity: 99,
      },
      power_bakery: {
        id: "power_bakery",
        from: "sub",
        to: "bakery",
        kind: "power",
        traversalTicks: 1,
        capacity: 99,
      },
      power_home: {
        id: "power_home",
        from: "sub",
        to: "home",
        kind: "power",
        traversalTicks: 1,
        capacity: 99,
      },
      power_workplace: {
        id: "power_workplace",
        from: "sub",
        to: "workplace",
        kind: "power",
        traversalTicks: 1,
        capacity: 99,
      },
      road_farm_bakery: {
        id: "road_farm_bakery",
        from: "farm",
        to: "bakery",
        kind: "road",
        traversalTicks: 2,
        capacity: 2,
      },
      road_bakery_market: {
        id: "road_bakery_market",
        from: "bakery",
        to: "market",
        kind: "road",
        traversalTicks: 2,
        capacity: 2,
      },
      road_market_home: {
        id: "road_market_home",
        from: "market",
        to: "home",
        kind: "road",
        traversalTicks: 2,
        capacity: 2,
      },
      road_home_workplace: {
        id: "road_home_workplace",
        from: "home",
        to: "workplace",
        kind: "road",
        traversalTicks: 2,
        capacity: 2,
      },
      road_home_dump: {
        id: "road_home_dump",
        from: "home",
        to: "dump",
        kind: "road",
        traversalTicks: 2,
        capacity: 2,
      },
      pipe_reservoir_bakery: {
        id: "pipe_reservoir_bakery",
        from: "reservoir",
        to: "bakery",
        kind: "pipe",
        traversalTicks: 2,
        capacity: 2,
      },
    },
  };
}

function tickEconomy(state: SimState, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    updatePowerFlags(state);
    produce(state);
    dispatch(state);
    advanceTokens(state);
    consume(state);
    state.tick++;
  }
}

describe("economy chain", () => {
  it("delivers food to a home when powered", () => {
    const state = buildMiniChain();
    tickEconomy(state, 40);
    expect(state.nodes.home.stock.food).toBeGreaterThan(0);
    expect(state.nodes.home.starving).toBe(false);
  });

  it("does not dispatch bakery food to market when unpowered", () => {
    const state = buildMiniChain();
    delete state.edges.power_bakery;
    updatePowerFlags(state);
    state.nodes.bakery.stock.food = 10;
    state.nodes.bakery.stock.water = 10;
    state.nodes.home.stock.food = 1;

    tickEconomy(state, 20);

    expect(state.nodes.bakery.powered).toBe(false);
    expect(
      Object.values(state.tokens).some((token) => token.destination === "market"),
    ).toBe(false);
    expect(state.nodes.home.starving).toBe(true);
  });

  it("stops bakery food dispatch when the water pipe is cut", () => {
    const state = buildMiniChain();
    updatePowerFlags(state);
    state.nodes.bakery.stock.food = 10;
    state.nodes.bakery.stock.water = 0;
    delete state.edges.pipe_reservoir_bakery;

    tickEconomy(state, 12);

    expect(state.nodes.bakery.powered).toBe(true);
    expect(state.nodes.bakery.stock.food).toBeGreaterThanOrEqual(10);
    expect(state.nodes.bakery.thirsty).toBe(true);
    expect(
      Object.values(state.tokens).some(
        (token) =>
          token.resource === "food" && token.destination === "market",
      ),
    ).toBe(false);
  });

  it("clogs homes and blocks labor when dump access is cut", () => {
    const state = buildMiniChain();
    updatePowerFlags(state);
    delete state.edges.road_home_dump;
    state.nodes.home.stock.food = 8;
    state.nodes.home.stock.waste = 7;
    state.nodes.home.stock.labor = 2;
    state.nodes.home.capacity.waste = 8;

    tickEconomy(state, 24);

    expect(state.nodes.home.clogged).toBe(true);
    expect(
      Object.values(state.tokens).some(
        (token) =>
          token.resource === "labor" && token.destination === "workplace",
      ),
    ).toBe(false);
  });
});
