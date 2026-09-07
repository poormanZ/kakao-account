export const GRID_SIZE = 3;
export const BOARD_SIZE = GRID_SIZE * GRID_SIZE;
export const CARDS_PER_TURN = 3;
export const MAX_TURNS_PER_ROUND = 9;
export const DEFAULT_REROLLS_PER_TURN = 1;
export const MAX_SYNERGY_LEVEL = 5;

export type Race = "goblin" | "elf" | "dwarf" | "dragon";
export type Job = "tank" | "warrior" | "healer" | "mage";

export interface Card {
  id: string;
  race: Race;
  job: Job;
}

export interface PlayerStats {
  attack: number;
  defense: number;
  maxHp: number;
  mana: number;
}

export type Board = Array<Card | null>;

export interface CandidateState {
  cards: Card[];
  rerollsUsed: number;
  selectedCardId: string | null;
}

export type GamePhase = "reroll" | "select" | "placement" | "combat" | "game_over";

export interface RoundState {
  round: number;
  turn: number;
  playerHp: number;
  playerMaxHp: number;
  monsterHp: number;
  monsterMaxHp: number;
  phase: GamePhase;
  candidates: CandidateState;
}

export interface GameState {
  board: Board;
  round: RoundState;
  maxClearedRound: number;
  gameOver: boolean;
}

export interface SynergyLine {
  axis: "row" | "column";
  index: number;
  race: Race | null;
  job: Job | null;
}

export interface SynergyResult {
  lines: SynergyLine[];
  races: Partial<Record<Race, number>>;
  jobs: Partial<Record<Job, number>>;
}

export const createEmptyBoard = (): Board => Array<Card | null>(BOARD_SIZE).fill(null);

export const createCard = (id: string, race: Race, job: Job): Card => ({ id, race, job });

export const createInitialState = (playerMaxHp = 100, monsterMaxHp = 30): GameState => ({
  board: createEmptyBoard(),
  round: {
    round: 1,
    turn: 1,
    playerHp: playerMaxHp,
    playerMaxHp,
    monsterHp: monsterMaxHp,
    monsterMaxHp,
    phase: "reroll",
    candidates: {
      cards: [],
      rerollsUsed: 0,
      selectedCardId: null,
    },
  },
  maxClearedRound: 0,
  gameOver: false,
});

export const isBoardFull = (board: Board): boolean => board.every((card) => card !== null);

export const placeCard = (board: Board, index: number, card: Card): Board => {
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE) {
    throw new Error("Invalid board index");
  }
  if (board[index] !== null) throw new Error("Board slot is already occupied");
  const next = [...board];
  next[index] = card;
  return next;
};

export const replaceCard = (board: Board, index: number, card: Card): Board => {
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE) {
    throw new Error("Invalid board index");
  }
  if (board[index] === null) throw new Error("Cannot replace an empty board slot");
  const next = [...board];
  next[index] = card;
  return next;
};

export const rerollCandidates = (
  candidates: Card[],
  rerollIndexes: number[],
  nextCards: Card[],
  rerollsUsed: number,
): CandidateState => {
  if (rerollsUsed >= DEFAULT_REROLLS_PER_TURN) throw new Error("Reroll limit reached");
  if (rerollIndexes.length === 0) throw new Error("Select at least one card to reroll");
  if (nextCards.length !== rerollIndexes.length) throw new Error("Replacement card count mismatch");

  const result = [...candidates];
  rerollIndexes.forEach((index, replacementIndex) => {
    if (!Number.isInteger(index) || index < 0 || index >= result.length) {
      throw new Error("Invalid candidate index");
    }
    result[index] = nextCards[replacementIndex];
  });

  return { cards: result, rerollsUsed: rerollsUsed + 1, selectedCardId: null };
};

export const selectCandidate = (state: CandidateState, cardId: string): CandidateState => {
  if (!state.cards.some((card) => card.id === cardId)) throw new Error("Card is not a candidate");
  return { ...state, selectedCardId: cardId };
};

const incrementSynergy = <T extends string>(
  values: Partial<Record<T, number>>,
  key: T,
): void => {
  values[key] = Math.min(MAX_SYNERGY_LEVEL, (values[key] ?? 0) + 1);
};

export const findBoardSynergy = (board: Board): SynergyResult => {
  const lines: SynergyLine[] = [];
  const races: Partial<Record<Race, number>> = {};
  const jobs: Partial<Record<Job, number>> = {};

  const addLine = (axis: "row" | "column", index: number, cards: Card[]): void => {
    if (cards.length !== GRID_SIZE || cards.some((card) => card === null)) return;

    const race = cards.every((card) => card.race === cards[0].race) ? cards[0].race : null;
    const job = cards.every((card) => card.job === cards[0].job) ? cards[0].job : null;
    if (race === null && job === null) return;

    lines.push({ axis, index, race, job });
    if (race !== null) incrementSynergy(races, race);
    if (job !== null) incrementSynergy(jobs, job);
  };

  for (let row = 0; row < GRID_SIZE; row += 1) {
    const cards = board.slice(row * GRID_SIZE, row * GRID_SIZE + GRID_SIZE);
    if (cards.every(Boolean)) addLine("row", row, cards as Card[]);
  }

  for (let column = 0; column < GRID_SIZE; column += 1) {
    const cards = [board[column], board[column + GRID_SIZE], board[column + GRID_SIZE * 2]];
    if (cards.every(Boolean)) addLine("column", column, cards as Card[]);
  }

  return { lines, races, jobs };
};

export const getJobBaseStatIncrease = (job: Job): keyof PlayerStats => {
  switch (job) {
    case "warrior":
      return "attack";
    case "tank":
      return "defense";
    case "healer":
      return "maxHp";
    case "mage":
      return "mana";
  }
};

export const getJobBaseStatValue = (_job: Job): number => 1;

export const getDwarfPlacementBonus = (dwarfSynergyLevel: number): number => {
  if (!Number.isInteger(dwarfSynergyLevel) || dwarfSynergyLevel < 0) {
    throw new Error("Invalid dwarf synergy level");
  }
  return Math.min(MAX_SYNERGY_LEVEL, dwarfSynergyLevel);
};

export const advanceTurn = (state: GameState): GameState => {
  if (state.gameOver) throw new Error("Game is already over");
  if (state.round.turn >= MAX_TURNS_PER_ROUND) throw new Error("Round turn limit reached");
  return {
    ...state,
    round: {
      ...state.round,
      turn: state.round.turn + 1,
      phase: "reroll",
      candidates: { cards: [], rerollsUsed: 0, selectedCardId: null },
    },
  };
};

export const clearRound = (state: GameState, nextMonsterMaxHp: number): GameState => ({
  ...state,
  maxClearedRound: state.round.round,
  round: {
    ...state.round,
    round: state.round.round + 1,
    turn: 1,
    monsterHp: nextMonsterMaxHp,
    monsterMaxHp: nextMonsterMaxHp,
    phase: "reroll",
    candidates: { cards: [], rerollsUsed: 0, selectedCardId: null },
  },
});

export const endGame = (state: GameState): GameState => ({
  ...state,
  gameOver: true,
  round: { ...state.round, phase: "game_over" },
});
