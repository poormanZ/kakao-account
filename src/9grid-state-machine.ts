import {
  advanceTurn,
  clearRound,
  createCard,
  findBoardSynergy,
  getJobBaseStatIncrease,
  getPlacementStatIncrease,
  getRerollLimit,
  placeCard,
  replaceCard,
  rerollCandidates,
  selectCandidate,
  type Board,
  type Card,
  type GameState,
  CARDS_PER_TURN,
  MAX_TURNS_PER_ROUND,
} from "./9grid";
import { getMonsterAttack, getMonsterMaxHp } from "./9grid-balance";
import { calculateCombat } from "./9grid-combat";

export interface CardGenerator { (count: number): Card[]; }
export interface TurnStartOptions { generateCards: CardGenerator; }
export interface CombatTurnOptions { monsterAttack?: number; }
const defaultCardGenerator: CardGenerator = (count) => Array.from({ length: count }, (_, index) => createCard(`generated-${Date.now()}-${index}`, "goblin", "warrior"));

export const startTurn = (state: GameState, { generateCards = defaultCardGenerator }: TurnStartOptions): GameState => {
  if (state.gameOver) throw new Error("Game is already over");
  if (state.round.phase !== "reroll") throw new Error("Turn has already started");
  const cards = generateCards(CARDS_PER_TURN);
  if (cards.length !== CARDS_PER_TURN) throw new Error("Card generator must return exactly three cards");
  return { ...state, round: { ...state.round, phase: "reroll", candidates: { cards, rerollsUsed: 0, selectedCardId: null } } };
};

export const rerollTurnCandidates = (state: GameState, generateCards: CardGenerator): GameState => {
  if (state.round.phase !== "reroll" && state.round.phase !== "select") throw new Error("Candidates can only be rerolled before selection");
  const synergy = findBoardSynergy(state.board);
  const rerollLimit = getRerollLimit(synergy.races.goblin ?? 0);
  if (state.round.candidates.rerollsUsed >= rerollLimit) throw new Error("Reroll limit reached");
  const nextCards = generateCards(CARDS_PER_TURN);
  const candidates = rerollCandidates(
    state.round.candidates.cards,
    Array.from({ length: CARDS_PER_TURN }, (_, index) => index),
    nextCards,
    state.round.candidates.rerollsUsed,
    rerollLimit,
  );
  return { ...state, round: { ...state.round, phase: "select", candidates } };
};

export const chooseTurnCard = (state: GameState, cardId: string): GameState => {
  if (state.round.phase !== "select") throw new Error("Card cannot be selected in the current phase");
  const candidates = selectCandidate(state.round.candidates, cardId);
  return { ...state, round: { ...state.round, phase: "placement", candidates } };
};

const applyPlacementStats = (state: GameState, card: Card, nextBoard: Board): GameState => {
  const nextSynergy = findBoardSynergy(nextBoard);
  const increase = getPlacementStatIncrease(card.job, nextSynergy.races.dwarf ?? 0);
  const statKey = getJobBaseStatIncrease(card.job);
  const nextStats = { ...state.playerStats };
  nextStats[statKey] += increase;
  const nextRound = { ...state.round, playerMaxHp: nextStats.maxHp, playerHp: Math.min(state.round.playerHp, nextStats.maxHp) };
  return { ...state, board: nextBoard, playerStats: nextStats, round: { ...nextRound, phase: "combat" } };
};

export const placeTurnCard = (state: GameState, boardIndex: number): GameState => {
  if (state.round.phase !== "placement") throw new Error("Card cannot be placed in the current phase");
  const card = state.round.candidates.cards.find((candidate) => candidate.id === state.round.candidates.selectedCardId);
  if (!card) throw new Error("Selected card is missing");
  const nextBoard: Board = state.board[boardIndex] === null ? placeCard(state.board, boardIndex, card) : replaceCard(state.board, boardIndex, card);
  return applyPlacementStats(state, card, nextBoard);
};

export const resolveTurnCombat = (state: GameState, { monsterAttack }: CombatTurnOptions = {}): GameState => {
  if (state.round.phase !== "placement" && state.round.phase !== "combat") throw new Error("Combat is not ready");
  const synergy = findBoardSynergy(state.board);
  const result = calculateCombat({ synergy, playerStats: state.playerStats, playerHp: state.round.playerHp, playerMaxHp: state.round.playerMaxHp, monsterHp: state.round.monsterHp, monsterAttack: monsterAttack ?? getMonsterAttack(state.round.round), board: state.board });
  const combatState: GameState = { ...state, round: { ...state.round, phase: "combat", playerHp: result.playerHpAfter, playerMaxHp: result.playerStats.maxHp, monsterHp: result.monsterHpAfter } };
  if (result.playerDefeated) return { ...combatState, gameOver: true, round: { ...combatState.round, phase: "game_over" } };
  if (result.monsterDefeated) return clearRound(combatState, getMonsterMaxHp(state.round.round + 1));
  if (state.round.turn >= MAX_TURNS_PER_ROUND) return { ...combatState, gameOver: true, round: { ...combatState.round, phase: "game_over" } };
  return advanceTurn(combatState);
};
