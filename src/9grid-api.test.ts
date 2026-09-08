import { describe, expect, it } from "vitest";
import { createCard, createInitialState } from "./9grid";
import { applyNineGridAction, createDefaultCardGenerator, parseNineGridAction } from "./9grid-api";

const cards = [
  createCard("a", "goblin", "warrior"),
  createCard("b", "elf", "tank"),
  createCard("c", "dwarf", "mage"),
];
const generateCards = (count: number) => cards.slice(0, count);

describe("9Grid action adapter", () => {
  it("validates and parses supported actions", () => {
    expect(parseNineGridAction({ type: "start" })).toEqual({ type: "start" });
    expect(parseNineGridAction({ type: "reroll" })).toEqual({ type: "reroll" });
    expect(parseNineGridAction({ type: "select", cardId: "a" })).toEqual({ type: "select", cardId: "a" });
    expect(parseNineGridAction({ type: "place", boardIndex: 4 })).toEqual({ type: "place", boardIndex: 4 });
    expect(parseNineGridAction({ type: "combat" })).toEqual({ type: "combat" });
  });

  it("rejects malformed or unsupported actions", () => {
    expect(() => parseNineGridAction(null)).toThrow("Invalid 9Grid action");
    expect(() => parseNineGridAction({ type: "start", extra: true })).toThrow("Invalid start action");
    expect(() => parseNineGridAction({ type: "reroll", indexes: [] })).toThrow("Invalid reroll action");
    expect(() => parseNineGridAction({ type: "select", cardId: "" })).toThrow("Invalid card id");
    expect(() => parseNineGridAction({ type: "place", boardIndex: 1.5 })).toThrow("Invalid board index");
    expect(() => parseNineGridAction({ type: "unknown" })).toThrow("Unsupported 9Grid action");
  });

  it("runs reroll -> select -> place -> combat and prepares the next turn automatically", () => {
    let state = createInitialState(100, 100);
    state = applyNineGridAction(state, parseNineGridAction({ type: "start" }), { generateCards });
    expect(state.round.phase).toBe("reroll");
    state = applyNineGridAction(state, parseNineGridAction({ type: "reroll" }), { generateCards });
    expect(state.round.phase).toBe("select");
    state = applyNineGridAction(state, parseNineGridAction({ type: "select", cardId: "a" }), { generateCards });
    state = applyNineGridAction(state, parseNineGridAction({ type: "place", boardIndex: 0 }), { generateCards });
    expect(state.round.phase).toBe("combat");
    expect(state.board[0]?.id).toBe("a");
    state = applyNineGridAction(state, parseNineGridAction({ type: "combat" }), { generateCards, monsterAttack: 0 });
    expect(state.round.phase).toBe("reroll");
    expect(state.round.turn).toBe(2);
    expect(state.round.candidates.cards).toHaveLength(3);
    expect(state.round.candidates.rerollsUsed).toBe(0);
  });

  it("restarts from a clean round 1 state", () => {
    let state = createInitialState(100, 100);
    state = applyNineGridAction(state, { type: "start" }, { generateCards });
    state = applyNineGridAction(state, { type: "reroll" }, { generateCards });
    state = applyNineGridAction(state, { type: "select", cardId: "a" }, { generateCards });
    state = applyNineGridAction(state, { type: "place", boardIndex: 0 }, { generateCards });
    const restarted = applyNineGridAction(state, { type: "start" }, { generateCards });
    expect(restarted.round.round).toBe(1);
    expect(restarted.round.turn).toBe(1);
    expect(restarted.round.phase).toBe("reroll");
    expect(restarted.board.every((card) => card === null)).toBe(true);
    expect(restarted.playerStats).toEqual(createInitialState().playerStats);
    expect(restarted.maxClearedRound).toBe(0);
    expect(restarted.gameOver).toBe(false);
  });

  it("does not execute selection before reroll", () => {
    const state = createInitialState();
    const started = applyNineGridAction(state, { type: "start" }, { generateCards });
    expect(() => applyNineGridAction(started, { type: "select", cardId: "a" }, { generateCards })).toThrow("current phase");
  });

  it("generates valid varied cards without client-controlled card data", () => {
    const generator = createDefaultCardGenerator();
    const generated = generator(9);
    expect(generated).toHaveLength(9);
    expect(new Set(generated.map((card) => card.id)).size).toBe(9);
    expect(generated.every((card) => ["goblin", "elf", "dwarf", "dragon"].includes(card.race))).toBe(true);
    expect(generated.every((card) => ["tank", "warrior", "healer", "mage"].includes(card.job))).toBe(true);
  });

  it("rejects unsafe card generation counts", () => {
    const generator = createDefaultCardGenerator();
    expect(() => generator(-1)).toThrow("Invalid card count");
    expect(() => generator(10)).toThrow("Invalid card count");
  });
});
