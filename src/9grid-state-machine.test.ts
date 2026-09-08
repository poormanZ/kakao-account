import { describe, expect, it } from "vitest";
import { createCard, createInitialState } from "./9grid";
import { chooseTurnCard, placeTurnCard, resolveTurnCombat, rerollTurnCandidates, startTurn } from "./9grid-state-machine";

const cards = [
  createCard("a", "goblin", "warrior"),
  createCard("b", "elf", "tank"),
  createCard("c", "dwarf", "mage"),
];
const generator = (count: number) => cards.slice(0, count);
const beginTurn = (state = createInitialState(100, 100)) =>
  rerollTurnCandidates(startTurn(state, { generateCards: generator }), generator);

describe("9Grid turn state machine", () => {
  it("runs reroll -> select -> placement -> combat -> next turn", () => {
    let state = beginTurn();
    state = chooseTurnCard(state, "a");
    state = placeTurnCard(state, 0);
    expect(state.round.phase).toBe("combat");
    expect(state.playerStats.attack).toBe(4);
    state = resolveTurnCombat(state, { monsterAttack: 1 });
    expect(state.round.phase).toBe("reroll");
    expect(state.round.turn).toBe(2);
    expect(state.board[0]?.id).toBe("a");
  });

  it("keeps job stat increases permanent when the slot is replaced", () => {
    let state = beginTurn();
    state = chooseTurnCard(state, "a");
    state = placeTurnCard(state, 0);
    expect(state.playerStats.attack).toBe(4);
    state = resolveTurnCombat(state, { monsterAttack: 0 });
    state = beginTurn(state);
    state = chooseTurnCard(state, "b");
    state = placeTurnCard(state, 0);
    expect(state.playerStats.attack).toBe(4);
    expect(state.playerStats.defense).toBe(4);
  });

  it("applies Dwarf synergy bonus using the synergy created by the placement", () => {
    let state = createInitialState(100, 100);
    state.board[0] = createCard("d1", "dwarf", "warrior");
    state.board[1] = createCard("d2", "dwarf", "tank");
    const d3 = createCard("d3", "dwarf", "mage");
    const dwarfGenerator = (count: number) => [d3, cards[0], cards[1]].slice(0, count);
    state = rerollTurnCandidates(startTurn(state, { generateCards: dwarfGenerator }), dwarfGenerator);
    state = chooseTurnCard(state, "d3");
    state = placeTurnCard(state, 2);
    expect(state.playerStats.mana).toBe(3);
  });

  it("keeps accumulated max HP when replacing a Healer card with a non-Healer", () => {
    let state = createInitialState(100, 100);
    const healer = createCard("healer", "elf", "healer");
    const healerGenerator = (count: number) => [healer, cards[0], cards[1]].slice(0, count);
    state = rerollTurnCandidates(startTurn(state, { generateCards: healerGenerator }), healerGenerator);
    state = chooseTurnCard(state, "healer");
    state = placeTurnCard(state, 0);
    expect(state.playerStats.maxHp).toBe(106);
    expect(state.round.playerMaxHp).toBe(106);
    expect(state.round.playerHp).toBe(100);
    state = resolveTurnCombat(state, { monsterAttack: 0 });
    state = beginTurn(state);
    state = chooseTurnCard(state, "a");
    state = placeTurnCard(state, 0);
    expect(state.playerStats.maxHp).toBe(106);
    expect(state.round.playerMaxHp).toBe(106);
    expect(state.round.playerHp).toBe(101);
  });

  it("uses actual placed Healer count for combat recovery", () => {
    let state = createInitialState(100, 1000);
    state.board[0] = createCard("h1", "goblin", "healer");
    state.board[1] = createCard("h2", "elf", "healer");
    state = beginTurn(state);
    state = chooseTurnCard(state, "a");
    state = placeTurnCard(state, 2);
    state = resolveTurnCombat(state, { monsterAttack: 0 });
    expect(state.round.playerHp).toBe(52);
  });

  it("requires a reroll before selection", () => {
    const state = startTurn(createInitialState(), { generateCards: generator });
    expect(state.round.phase).toBe("reroll");
    expect(() => chooseTurnCard(state, "a")).toThrow("current phase");
  });

  it("allows a selected card to replace or fill any slot in every round", () => {
    let state = beginTurn();
    state = chooseTurnCard(state, "a");
    state = placeTurnCard(state, 0);
    state = resolveTurnCombat(state, { monsterAttack: 0 });
    state = beginTurn(state);
    state = chooseTurnCard(state, "b");
    state = placeTurnCard(state, 1);
    expect(state.board[1]?.id).toBe("b");
    state = resolveTurnCombat(state, { monsterAttack: 0 });
    state = beginTurn(state);
    state = chooseTurnCard(state, "c");
    state = placeTurnCard(state, 0);
    expect(state.board[0]?.id).toBe("c");
  });

  it("allows Goblin synergy to increase the reroll limit", () => {
    let state = createInitialState();
    state.board[0] = createCard("g1", "goblin", "warrior");
    state.board[1] = createCard("g2", "goblin", "warrior");
    state.board[2] = createCard("g3", "goblin", "warrior");
    state = startTurn(state, { generateCards: generator });
    const rerollGenerator = (count: number) =>
      Array.from({ length: count }, (_, index) => createCard(`replacement-${index}`, "dragon", "healer"));
    state = rerollTurnCandidates(state, rerollGenerator);
    state = rerollTurnCandidates(state, rerollGenerator);
    expect(state.round.candidates.rerollsUsed).toBe(2);
    state = rerollTurnCandidates(state, rerollGenerator);
    expect(state.round.candidates.rerollsUsed).toBe(3);
    expect(() => rerollTurnCandidates(state, rerollGenerator)).toThrow("limit");
  });

  it("clears the round immediately when the monster dies", () => {
    let state = beginTurn(createInitialState(100, 1));
    state = chooseTurnCard(state, "a");
    state = placeTurnCard(state, 0);
    state = resolveTurnCombat(state, { monsterAttack: 99 });
    expect(state.gameOver).toBe(false);
    expect(state.maxClearedRound).toBe(1);
    expect(state.round.round).toBe(2);
    expect(state.round.turn).toBe(1);
    expect(state.round.phase).toBe("reroll");
    expect(state.round.monsterMaxHp).toBe(180);
  });

  it("ends the game when turn 9 ends with the monster alive", () => {
    let state = createInitialState(100, 1000);
    for (let turn = 1; turn <= 9; turn += 1) {
      state = beginTurn(state);
      state = chooseTurnCard(state, "a");
      state = placeTurnCard(state, turn - 1);
      state = resolveTurnCombat(state, { monsterAttack: 0 });
    }
    expect(state.gameOver).toBe(true);
    expect(state.round.phase).toBe("game_over");
    expect(state.round.turn).toBe(9);
  });

  it("ends immediately when player HP reaches zero", () => {
    let state = beginTurn(createInitialState(1, 100));
    state = chooseTurnCard(state, "a");
    state = placeTurnCard(state, 0);
    state = resolveTurnCombat(state, { monsterAttack: 99 });
    expect(state.gameOver).toBe(true);
    expect(state.round.phase).toBe("game_over");
  });
});
