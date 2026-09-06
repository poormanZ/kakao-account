import { describe, expect, it } from "vitest";
import { createCard, createInitialState } from "./9grid";
import { chooseTurnCard, placeTurnCard, resolveTurnCombat, rerollTurnCandidates, startTurn } from "./9grid-state-machine";

const cards = [
  createCard("a", "fire", "warrior"),
  createCard("b", "water", "tank"),
  createCard("c", "wind", "mage"),
];
const generator = (count: number) => cards.slice(0, count);

describe("9Grid turn state machine", () => {
  it("runs start -> select -> placement -> combat -> next turn", () => {
    let state = createInitialState(100, 100);
    state = startTurn(state, { generateCards: generator });
    expect(state.round.phase).toBe("select");
    state = chooseTurnCard(state, "a");
    expect(state.round.phase).toBe("placement");
    state = placeTurnCard(state, 0);
    expect(state.round.phase).toBe("combat");
    state = resolveTurnCombat(state, { monsterAttack: 1 });
    expect(state.round.phase).toBe("reroll");
    expect(state.round.turn).toBe(2);
    expect(state.board[0]?.id).toBe("a");
  });

  it("rerolls only selected cards and keeps one reroll per turn", () => {
    let state = startTurn(createInitialState(), { generateCards: generator });
    const rerollGenerator = (count: number) => [createCard("replacement", "earth", "healer")].slice(0, count);
    state = rerollTurnCandidates(state, [1], rerollGenerator);
    expect(state.round.candidates.cards.map((card) => card.id)).toEqual(["a", "replacement", "c"]);
    expect(() => rerollTurnCandidates(state, [0], rerollGenerator)).toThrow("limit");
  });

  it("clears the round immediately when the monster dies", () => {
    let state = createInitialState(100, 1);
    state = startTurn(state, { generateCards: generator });
    state = chooseTurnCard(state, "a");
    state = placeTurnCard(state, 0);
    state = resolveTurnCombat(state, { monsterAttack: 99 });
    expect(state.gameOver).toBe(false);
    expect(state.maxClearedRound).toBe(1);
    expect(state.round.round).toBe(2);
    expect(state.round.turn).toBe(1);
    expect(state.round.phase).toBe("reroll");
    expect(state.round.monsterMaxHp).toBe(2);
  });

  it("ends the game when turn 9 ends with the monster alive", () => {
    let state = createInitialState(100, 1000);
    for (let turn = 1; turn <= 9; turn += 1) {
      state = startTurn(state, { generateCards: generator });
      state = chooseTurnCard(state, "a");
      state = placeTurnCard(state, turn - 1);
      state = resolveTurnCombat(state, { monsterAttack: 0 });
    }
    expect(state.gameOver).toBe(true);
    expect(state.round.phase).toBe("game_over");
    expect(state.round.turn).toBe(9);
  });

  it("ends immediately when player HP reaches zero", () => {
    let state = createInitialState(1, 100);
    state = startTurn(state, { generateCards: generator });
    state = chooseTurnCard(state, "a");
    state = placeTurnCard(state, 0);
    state = resolveTurnCombat(state, { monsterAttack: 99 });
    expect(state.gameOver).toBe(true);
    expect(state.round.phase).toBe("game_over");
  });
});
