import type { Card, GameState, Job, Race } from "./9grid";
import {
  chooseTurnCard,
  placeTurnCard,
  rerollTurnCandidates,
  resolveTurnCombat,
  startTurn,
  type CardGenerator,
} from "./9grid-state-machine";

export type NineGridAction =
  | { type: "start" }
  | { type: "reroll" }
  | { type: "select"; cardId: string }
  | { type: "place"; boardIndex: number }
  | { type: "combat" };

export interface NineGridActionDependencies {
  generateCards: CardGenerator;
  monsterAttack?: number;
}

const RACES: readonly Race[] = ["goblin", "elf", "dwarf", "dragon"];
const JOBS: readonly Job[] = ["tank", "warrior", "healer", "mage"];
const BOARD_SIZE = 9;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 100;

const isInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

export const parseNineGridAction = (value: unknown): NineGridAction => {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("Invalid 9Grid action");
  }

  switch (value.type) {
    case "start":
      if (Object.keys(value).length !== 1) throw new Error("Invalid start action");
      return { type: "start" };
    case "reroll":
      if (Object.keys(value).length !== 1) throw new Error("Invalid reroll action");
      return { type: "reroll" };
    case "select":
      if (!isNonEmptyString(value.cardId)) throw new Error("Invalid card id");
      return { type: "select", cardId: value.cardId };
    case "place":
      if (!isInteger(value.boardIndex) || value.boardIndex < 0 || value.boardIndex >= BOARD_SIZE) {
        throw new Error("Invalid board index");
      }
      return { type: "place", boardIndex: value.boardIndex };
    case "combat":
      if (Object.keys(value).length !== 1) throw new Error("Invalid combat action");
      return { type: "combat" };
    default:
      throw new Error("Unsupported 9Grid action");
  }
};

export const applyNineGridAction = (
  state: GameState,
  action: NineGridAction,
  { generateCards, monsterAttack }: NineGridActionDependencies,
): GameState => {
  switch (action.type) {
    case "start":
      return startTurn(createInitialState(), { generateCards });
    case "reroll":
      return rerollTurnCandidates(state, generateCards);
    case "select":
      return chooseTurnCard(state, action.cardId);
    case "place":
      return placeTurnCard(state, action.boardIndex);
    case "combat": {
      const combatState = resolveTurnCombat(state, { monsterAttack });
      if (combatState.gameOver || combatState.round.phase !== "reroll") {
        return combatState;
      }
      return startTurn(combatState, { generateCards });
    }
  }
};

const randomIndex = (maxExclusive: number): number => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % maxExclusive;
};

export const createDefaultCardGenerator = (): CardGenerator => (count: number): Card[] => {
  if (!Number.isInteger(count) || count < 0 || count > 9) {
    throw new Error("Invalid card count");
  }

  return Array.from({ length: count }, () => ({
    id: `generated-${crypto.randomUUID()}`,
    race: RACES[randomIndex(RACES.length)],
    job: JOBS[randomIndex(JOBS.length)],
  }));
};

function createInitialState(): GameState {
  return {
    ...stateDefaults(),
  };
}

function stateDefaults(): GameState {
  return requireInitialState();
}

function requireInitialState(): GameState {
  const initial = createStateForRestart();
  return initial;
}

function createStateForRestart(): GameState {
  return createGameState();
}

function createGameState(): GameState {
  return {
    board: Array(9).fill(null),
    playerStats: { attack: 1, defense: 1, maxHp: 100, mana: 0 },
    round: {
      round: 1,
      turn: 1,
      playerHp: 100,
      playerMaxHp: 100,
      monsterHp: 100,
      monsterMaxHp: 100,
      phase: "reroll",
      candidates: { cards: [], rerollsUsed: 0, selectedCardId: null },
    },
    maxClearedRound: 0,
    lastRoundClearTurn: 0,
    gameOver: false,
  };
}
