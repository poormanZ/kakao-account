import type { Card, GameState, Job, Race } from "./9grid";

export interface NineGridSessionEnv {
  DB: D1Database;
}

const RACES: readonly Race[] = ["goblin", "elf", "dwarf", "dragon"];
const JOBS: readonly Job[] = ["tank", "warrior", "healer", "mage"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isCard = (value: unknown): value is Card => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 100 &&
    typeof value.race === "string" &&
    RACES.includes(value.race as Race) &&
    typeof value.job === "string" &&
    JOBS.includes(value.job as Job)
  );
};

const isGameState = (value: unknown): value is GameState => {
  if (!isRecord(value) || !Array.isArray(value.board)) return false;
  if (value.board.length !== 9 || !value.board.every((card) => card === null || isCard(card))) return false;
  if (!isRecord(value.playerStats) || !isRecord(value.round)) return false;
  const stats = value.playerStats;
  const round = value.round;
  if (![stats.attack, stats.defense, stats.maxHp, stats.mana].every(isFiniteNonNegativeNumber)) return false;
  if (
    !isFiniteNonNegativeNumber(round.round) ||
    !isFiniteNonNegativeNumber(round.turn) ||
    !isFiniteNonNegativeNumber(round.playerHp) ||
    !isFiniteNonNegativeNumber(round.playerMaxHp) ||
    !isFiniteNonNegativeNumber(round.monsterHp) ||
    !isFiniteNonNegativeNumber(round.monsterMaxHp) ||
    typeof round.phase !== "string" ||
    !["reroll", "select", "placement", "combat", "game_over"].includes(round.phase)
  ) return false;
  if (!isRecord(round.candidates) || !Array.isArray(round.candidates.cards)) return false;
  if (!round.candidates.cards.every(isCard)) return false;
  if (!isFiniteNonNegativeNumber(round.candidates.rerollsUsed)) return false;
  if (round.candidates.selectedCardId !== null && typeof round.candidates.selectedCardId !== "string") return false;
  return Number.isInteger(value.maxClearedRound) && value.maxClearedRound >= 0 && typeof value.gameOver === "boolean";
};

export const load9GridSession = async (
  env: NineGridSessionEnv,
  userId: number,
): Promise<GameState | null> => {
  const row = await env.DB
    .prepare('SELECT state_json FROM "9grid_sessions" WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ state_json: string }>();
  if (!row) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.state_json);
  } catch {
    throw new Error("Stored 9Grid state is invalid");
  }
  if (!isGameState(parsed)) throw new Error("Stored 9Grid state is invalid");
  return parsed;
};

export const save9GridSession = async (
  env: NineGridSessionEnv,
  userId: number,
  state: GameState,
): Promise<void> => {
  if (!isGameState(state)) throw new Error("Cannot persist invalid 9Grid state");
  await env.DB
    .prepare(`INSERT INTO "9grid_sessions" (user_id, state_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = CURRENT_TIMESTAMP`)
    .bind(userId, JSON.stringify(state))
    .run();
};

export const delete9GridSession = async (env: NineGridSessionEnv, userId: number): Promise<void> => {
  await env.DB.prepare('DELETE FROM "9grid_sessions" WHERE user_id = ?').bind(userId).run();
};
