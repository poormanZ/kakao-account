import {
  advanceTurn,
  clearRound,
  createCard,
  findBoardSynergy,
  placeCard,
  replaceCard,
  rerollCandidates,
  selectCandidate,
  type Board,
  type Card,
  type GameState,
} from "./9grid";
import { calculateCombat } from "./9grid-combat";
import { CARDS_PER_TURN, DEFAULT_REROLLS_PER_TURN, MAX_TURNS_PER_ROUND } from "./9grid";

export interface CardGenerator {
  (count: number): Card[];
}

export interface TurnStartOptions {
  generateCards: CardGenerator;
}

export interface CombatTurnOptions {
  monsterAttack?: number;
  critRoll?: number;
}

const defaultCardGenerator: CardGenerator = (count) =>
  Array.from({ length: count }, (_, index) =>
    createCard(`generated-${Date.now()}-${index}`, "fire", "warrior"),
  );

export const startTurn = (
  state: GameState,
  { generateCards = defaultCardGenerator }: TurnStartOptions,
): GameState => {
  if (state.gameOver) throw new Error("Game is already over");
  if (state.round.phase !== "reroll") throw new Error("Turn has already started");
  const cards = generateCards(CARDS_PER_TURN);
  if (cards.length !== CARDS_PER_TURN) throw new Error("Card generator must return exactly three cards");

  return {
    ...state,
    round: {
      ...state.round,
      phase: "select",
      candidates: { cards, rerollsUsed: 0, selectedCardId: null },
    },
  };
};

export const rerollTurnCandidates = (
  state: GameState,
  rerollIndexes: number[],
  generateCards: CardGenerator,
): GameState => {
  if (state.round.phase !== "select") throw new Error("Candidates can only be rerolled during selection");
  if (state.round.candidates.rerollsUsed >= DEFAULT_REROLLS_PER_TURN) {
    throw new Error("Reroll limit reached");
  }
  const nextCards = generateCards(rerollIndexes.length);
  const candidates = rerollCandidates(
    state.round.candidates.cards,
    rerollIndexes,
    nextCards,
    state.round.candidates.rerollsUsed,
  );
  return { ...state, round: { ...state.round, candidates } };
};

export const chooseTurnCard = (state: GameState, cardId: string): GameState => {
  if (state.round.phase !== "select") throw new Error("Card cannot be selected in the current phase");
  const candidates = selectCandidate(state.round.candidates, cardId);
  return { ...state, round: { ...state.round, phase: "placement", candidates } };
};

export const placeTurnCard = (state: GameState, boardIndex: number): GameState => {
  if (state.round.phase !== "placement") throw new Error("Card cannot be placed in the current phase");
  const card = state.round.candidates.cards.find((candidate) => candidate.id === state.round.candidates.selectedCardId);
  if (!card) throw new Error("Selected card is missing");

  const nextBoard: Board = state.round.round === 1
    ? placeCard(state.board, boardIndex, card)
    : replaceCard(state.board, boardIndex, card);

  return { ...state, board: nextBoard, round: { ...state.round, phase: "combat" } };
};

export const resolveTurnCombat = (
  state: GameState,
  { monsterAttack = 8, critRoll = 1 }: CombatTurnOptions = {},
): GameState => {
  if (state.round.phase !== "select" && state.round.phase !== "placement" && state.round.phase !== "combat") {
    throw new Error("Combat is not ready");
  }
  const synergy = findBoardSynergy(state.board);
  const result = calculateCombat({
    synergy,
    playerHp: state.round.playerHp,
    playerMaxHp: state.round.playerMaxHp,
    monsterHp: state.round.monsterHp,
    monsterAttack,
    critRoll,
  });

  const combatState: GameState = {
    ...state,
    round: {
      ...state.round,
      phase: "combat",
      playerHp: result.playerHpAfter,
      monsterHp: result.monsterHpAfter,
    },
  };

  if (result.playerDefeated) return { ...combatState, gameOver: true, round: { ...combatState.round, phase: "game_over" } };
  if (result.monsterDefeated) return clearRound(combatState, Math.ceil(state.round.monsterMaxHp * 1.25));
  if (state.round.turn >= MAX_TURNS_PER_ROUND) return { ...combatState, gameOver: true, round: { ...combatState.round, phase: "game_over" } };

  return advanceTurn(combatState);
};
