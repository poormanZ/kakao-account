import { describe, expect, it } from "vitest";
import {
  createCard,
  createEmptyBoard,
  createInitialState,
  findBoardSynergy,
  isBoardFull,
  placeCard,
  replaceCard,
  rerollCandidates,
  selectCandidate,
} from "./9grid";

const fireWarrior = (id: string) => createCard(id, "fire", "warrior");

const filledBoard = () => [
  fireWarrior("a"), fireWarrior("b"), fireWarrior("c"),
  createCard("d", "water", "tank"), createCard("e", "wind", "healer"), createCard("f", "earth", "mage"),
  createCard("g", "water", "tank"), createCard("h", "wind", "healer"), createCard("i", "earth", "mage"),
];

describe("9Grid core state", () => {
  it("starts with an empty 3x3 board and round 1 turn 1", () => {
    const state = createInitialState();
    expect(state.board).toHaveLength(9);
    expect(isBoardFull(state.board)).toBe(false);
    expect(state.round.round).toBe(1);
    expect(state.round.turn).toBe(1);
    expect(state.gameOver).toBe(false);
  });

  it("places cards only into empty slots and replaces occupied slots", () => {
    let board = createEmptyBoard();
    board = placeCard(board, 0, fireWarrior("a"));
    expect(board[0]?.id).toBe("a");
    expect(() => placeCard(board, 0, fireWarrior("b"))).toThrow("already occupied");
    board = replaceCard(board, 0, fireWarrior("b"));
    expect(board[0]?.id).toBe("b");
    expect(() => replaceCard(board, 1, fireWarrior("c"))).toThrow("empty");
  });

  it("rerolls only selected candidates once per turn", () => {
    const candidates = [fireWarrior("a"), createCard("b", "water", "tank"), createCard("c", "wind", "mage")];
    const result = rerollCandidates(candidates, [1], [createCard("d", "earth", "healer")], 0);
    expect(result.cards.map((card) => card.id)).toEqual(["a", "d", "c"]);
    expect(result.rerollsUsed).toBe(1);
    expect(() => rerollCandidates(result.cards, [0], [fireWarrior("e")], result.rerollsUsed)).toThrow("limit");
  });

  it("selects exactly one candidate by id", () => {
    const state = { cards: [fireWarrior("a"), fireWarrior("b"), fireWarrior("c")], rerollsUsed: 0, selectedCardId: null };
    expect(selectCandidate(state, "b").selectedCardId).toBe("b");
    expect(() => selectCandidate(state, "missing")).toThrow("candidate");
  });

  it("detects horizontal and vertical element/job synergies", () => {
    const result = findBoardSynergy(filledBoard());
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toMatchObject({ axis: "row", index: 0, element: "fire", job: "warrior" });
    expect(result.elements.fire).toBe(1);
    expect(result.jobs.warrior).toBe(1);
    expect(result.lines.some((line) => line.axis === "column")).toBe(true);
  });

  it("does not count diagonals as synergy", () => {
    const board = [
      fireWarrior("a"), createCard("b", "water", "tank"), createCard("c", "wind", "mage"),
      createCard("d", "water", "healer"), fireWarrior("e"), createCard("f", "earth", "tank"),
      createCard("g", "wind", "healer"), createCard("h", "earth", "mage"), fireWarrior("i"),
    ];
    expect(findBoardSynergy(board).lines).toHaveLength(0);
  });
});
