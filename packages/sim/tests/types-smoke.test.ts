import { describe, expect, it } from "vitest";
import type { StockPile } from "../src/types";

describe("types", () => {
  it("allows empty stock piles", () => {
    const stock: StockPile = { food: 0, energy: 0, labor: 0 };
    expect(stock.food).toBe(0);
  });
});
