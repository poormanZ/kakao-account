import type { Card, GameState, Job, Race } from "./9grid";

export interface NineGridSessionEnv { DB: D1Database; }

export interface NineGridSessionRecord {
  state: GameState;
  version: number;
  lastActionId: string | null;
  lastActionResponseJson: string | null;
}

export class NineGridSessionConflictError extends Error {
  constructor() {
    super("9Grid session was modified concurrently");
    this.name = "NineGridSessionConflictError";
  }
}

const RACES: readonly Race[] = ["goblin", "elf", "dwarf", "dragon"];
const JOBS: readonly Job[] = ["tank", "warrior", "healer", "mage"];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNonNegativeNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isNonNegativeInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isPositiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;

const isCard = (value: unknown): value is Card => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 100
    && typeof value.race === "string" && RACES.includes(value.race as Race)
    && typeof value.job === "string" && JOBS.includes(value.job as Job);
};

export const isGameState = (value: unknown): value is GameState => {
  if (!isRecord(value) || !Array.isArray(value.board)) return false;
  if (value.board.length !== 9 || !value.board.every((card) => card === null || isCard(card))) return false;
  if (!isRecord(value.playerStats) || !isRecord(value.round)) return false;
  const stats = value.playerStats;
  const round = value.round;
  if (![stats.attack, stats.defense, stats.maxHp, stats.mana].every(isFiniteNonNegativeNumber)) return false;
  if (!isFiniteNonNegativeNumber(round.round) || !isFiniteNonNegativeNumber(round.turn)
    || !isFiniteNonNegativeNumber(round.playerHp) || !isFiniteNonNegativeNumber(round.playerMaxHp)
    || !isFiniteNonNegativeNumber(round.monsterHp) || !isFiniteNonNegativeNumber(round.monsterMaxHp)
    || typeof round.phase !== "string"
    || !["reroll", "select", "placement", "combat", "game_over"].includes(round.phase)) return false;
  if (!isRecord(round.candidates) || !Array.isArray(round.candidates.cards)) return false;
  if (!round.candidates.cards.every(isCard)) return false;
  if (!isFiniteNonNegativeNumber(round.candidates.rerollsUsed)) return false;
  if (round.candidates.selectedCardId !== null && typeof round.candidates.selectedCardId !== "string") return false;
  return isNonNegativeInteger(value.maxClearedRound)
    && isNonNegativeInteger(value.lastRoundClearTurn)
    && value.lastRoundClearTurn <= 9
    && typeof value.gameOver === "boolean";
};

const parseState = (stateJson: string): GameState => {
  let parsed: unknown;
  try { parsed = JSON.parse(stateJson); } catch { throw new Error("Stored 9Grid state is invalid"); }
  if (!isGameState(parsed)) throw new Error("Stored 9Grid state is invalid");
  return parsed;
};

const isActionId = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 16 && value.length <= 100;
const isResponseJson = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 200_000;

export const load9GridSessionRecord = async (
  env: NineGridSessionEnv,
  userId: number,
): Promise<NineGridSessionRecord | null> => {
  const row = await env.DB
    .prepare('SELECT state_json, version, last_action_id, last_action_response_json FROM "9grid_sessions" WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ state_json: string; version: number; last_action_id: string | null; last_action_response_json: string | null }>();
  if (!row) return null;
  if (!isPositiveInteger(row.version)) throw new Error("Stored 9Grid session version is invalid");
  if (row.last_action_id !== null && !isActionId(row.last_action_id)) throw new Error("Stored 9Grid action id is invalid");
  if (row.last_action_response_json !== null && !isResponseJson(row.last_action_response_json)) throw new Error("Stored 9Grid action response is invalid");
  return { state: parseState(row.state_json), version: row.version, lastActionId: row.last_action_id, lastActionResponseJson: row.last_action_response_json };
};

export const load9GridSession = async (env: NineGridSessionEnv, userId: number): Promise<GameState | null> => {
  const record = await load9GridSessionRecord(env, userId);
  return record?.state ?? null;
};

export const create9GridSession = async (
  env: NineGridSessionEnv,
  userId: number,
  state: GameState,
  lastActionId: string | null = null,
  lastActionResponseJson: string | null = null,
): Promise<NineGridSessionRecord> => {
  if (!isGameState(state)) throw new Error("Cannot persist invalid 9Grid state");
  if (lastActionId !== null && !isActionId(lastActionId)) throw new Error("Invalid 9Grid action id");
  if (lastActionResponseJson !== null && !isResponseJson(lastActionResponseJson)) throw new Error("Invalid 9Grid action response");
  await env.DB.prepare('INSERT INTO "9grid_sessions" (user_id, state_json, updated_at, version, last_action_id, last_action_response_json) VALUES (?, ?, CURRENT_TIMESTAMP, 1, ?, ?)')
    .bind(userId, JSON.stringify(state), lastActionId, lastActionResponseJson).run();
  return { state, version: 1, lastActionId, lastActionResponseJson };
};

export const update9GridSession = async (
  env: NineGridSessionEnv,
  userId: number,
  state: GameState,
  expectedVersion: number,
  lastActionId: string | null = null,
  lastActionResponseJson: string | null = null,
): Promise<NineGridSessionRecord> => {
  if (!isGameState(state)) throw new Error("Cannot persist invalid 9Grid state");
  if (!isPositiveInteger(expectedVersion)) throw new Error("Invalid 9Grid session version");
  if (lastActionId !== null && !isActionId(lastActionId)) throw new Error("Invalid 9Grid action id");
  if (lastActionResponseJson !== null && !isResponseJson(lastActionResponseJson)) throw new Error("Invalid 9Grid action response");
  const nextVersion = expectedVersion + 1;
  const result = await env.DB.prepare('UPDATE "9grid_sessions" SET state_json = ?, updated_at = CURRENT_TIMESTAMP, version = ?, last_action_id = ?, last_action_response_json = ? WHERE user_id = ? AND version = ?')
    .bind(JSON.stringify(state), nextVersion, lastActionId, lastActionResponseJson, userId, expectedVersion).run();
  if (result.meta.changes !== 1) throw new NineGridSessionConflictError();
  return { state, version: nextVersion, lastActionId, lastActionResponseJson };
};

export const delete9GridSession = async (env: NineGridSessionEnv, userId: number): Promise<void> => {
  await env.DB.prepare('DELETE FROM "9grid_sessions" WHERE user_id = ?').bind(userId).run();
};
