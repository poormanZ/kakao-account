import { describe, expect, it } from "vitest";
import { createCard, createInitialState } from "./9grid";
import { present9GridState } from "./9grid-presenter";

describe("9Grid presenter", () => {
  it("maps core state and calculates the current reroll limit", () => {
    const state = createInitialState(100, 30);
    state.board[0] = createCard("g1", "goblin", "warrior");
    state.board[1] = createCard("g2", "goblin", "tank");
    state.board[2] = createCard("g3", "goblin", "mage");
    state.round.candidates.cards = [createCard("c1", "elf", "healer")];
    state.round.candidates.selectedCardId = "c1";
    const view = present9GridState(state, 12);
    expect(view.round).toBe(1);
    expect(view.playerHp).toBe(100);
    expect(view.playerStats).toEqual({ attack: 2, defense: 2, maxHp: 100, mana: 1 });
    expect(view.score).toBe(12);
    expect(view.rerollLimit).toBe(2);
    expect(view.activeRaces).toEqual([{ race: "goblin", level: 1 }]);
    expect(view.selectedCardId).toBe("c1");
  });

  it("returns defensive copies for board, candidates, and player stats", () => {
    const state = createInitialState();
    const card = createCard("c1", "dragon", "mage");
    state.board[0] = card;
    state.round.candidates.cards = [card];
    const view = present9GridState(state);
    view.board[0]!.job = "warrior";
    view.candidates[0].race = "goblin";
    view.playerStats.attack = 99;
    expect(state.board[0]?.job).toBe("mage");
    expect(state.round.candidates.cards[0]?.race).toBe("dragon");
    expect(state.playerStats.attack).toBe(2);
  });
});
