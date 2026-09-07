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
  | { type: "reroll"; indexes: number[] }
  | { type: "select"; cardId: string }
  | { type: "place"; boardIndex: number }
  | { type: "combat" };

export interface NineGridActionDependencies {
  generateCards: CardGenerator;
  monsterAttack?: number;
}

const RACES: readonly Race[] = ["goblin", "elf", "dwarf", "dragon"];
const JOBS: readonly Job[] = ["tank", "warrior", "healer", "mage"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 100;

const isInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

const parseIndexes = (value: unknown): number[] | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 3) return null;
  if (!value.every(isInteger)) return null;
  return value;
};

export const parseNineGridAction = (value: unknown): NineGridAction => {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("Invalid 9Grid action");
  }

  switch (value.type) {
    case "start":
      if (Object.keys(value).length !== 1) throw new Error("Invalid start action");
      return { type: "start" };
    case "reroll": {
      const indexes = parseIndexes(value.indexes);
      if (!indexes) throw new Error("Invalid reroll indexes");
      return { type: "reroll", indexes };
    }
    case "select":
      if (!isNonEmptyString(value.cardId)) throw new Error("Invalid card id");
      return { type: "select", cardId: value.cardId };
    case "place":
      if (!isInteger(value.boardIndex)) throw new Error("Invalid board index");
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
      return startTurn(state, { generateCards });
    case "reroll":
      return rerollTurnCandidates(state, action.indexes, generateCards);
    case "select":
      return chooseTurnCard(state, action.cardId);
    case "place":
      return placeTurnCard(state, action.boardIndex);
    case "combat":
      return resolveTurnCombat(state, { monsterAttack });
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
