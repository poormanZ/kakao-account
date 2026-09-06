import { getAuthenticatedUser, type AuthUser } from "./auth";

export interface ScoreEnv { DB: D1Database; GAME_DB?: D1Database; }
export interface NineGridScore { id: number; account_user_id: number; max_round: number; last_round_clear_turn: number; remaining_hp: number; created_at: string; }
interface ScoreRow extends NineGridScore {}
const SCORE_LIMIT = 100;
const dbForScores = (env: ScoreEnv): D1Database => env.GAME_DB ?? env.DB;
const scoreJson = (data: unknown, status = 200): Response => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const parseNonNegativeInt = (value: unknown): number | null => typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

const parseScoreBody = async (request: Request): Promise<{ max_round: number; last_round_clear_turn: number; remaining_hp: number } | null> => {
  if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return null;
  try {
    const body = await request.json() as Record<string, unknown>;
    const maxRound = parseNonNegativeInt(body.max_round);
    const clearTurn = parseNonNegativeInt(body.last_round_clear_turn);
    const remainingHp = parseNonNegativeInt(body.remaining_hp);
    if (maxRound === null || clearTurn === null || remainingHp === null || maxRound > 10_000 || clearTurn > 9 || remainingHp > 1_000_000) return null;
    return { max_round: maxRound, last_round_clear_turn: clearTurn, remaining_hp: remainingHp };
  } catch { return null; }
};

export const save9GridScore = async (request: Request, env: ScoreEnv, user: AuthUser): Promise<Response> => {
  const body = await parseScoreBody(request);
  if (!body) return scoreJson({ error: "Invalid score" }, 400);
  try {
    await dbForScores(env).prepare(`INSERT INTO "9grid_scores" (account_user_id, max_round, last_round_clear_turn, remaining_hp) VALUES (?, ?, ?, ?)`).bind(user.id, body.max_round, body.last_round_clear_turn, body.remaining_hp).run();
    return scoreJson({ saved: true });
  } catch { return scoreJson({ error: "Score service unavailable" }, 503); }
};

export const get9GridBestScore = async (env: ScoreEnv, user: AuthUser): Promise<Response> => {
  try {
    const row = await dbForScores(env).prepare(`SELECT id, account_user_id, max_round, last_round_clear_turn, remaining_hp, created_at FROM "9grid_scores" WHERE account_user_id = ? ORDER BY max_round DESC, last_round_clear_turn ASC, remaining_hp DESC, created_at ASC LIMIT 1`).bind(user.id).first<ScoreRow>();
    return scoreJson({ score: row ?? null });
  } catch { return scoreJson({ error: "Score service unavailable" }, 503); }
};

export const get9GridMyRank = async (env: ScoreEnv, user: AuthUser): Promise<Response> => {
  try {
    const best = await dbForScores(env).prepare(`SELECT max_round, last_round_clear_turn, remaining_hp, created_at FROM "9grid_scores" WHERE account_user_id = ? ORDER BY max_round DESC, last_round_clear_turn ASC, remaining_hp DESC, created_at ASC LIMIT 1`).bind(user.id).first<Pick<NineGridScore, "max_round" | "last_round_clear_turn" | "remaining_hp" | "created_at">>();
    if (!best) return scoreJson({ rank: null, score: null });
    const rankRow = await dbForScores(env).prepare(`SELECT COUNT(*) + 1 AS rank FROM "9grid_scores" WHERE max_round > ? OR (max_round = ? AND last_round_clear_turn < ?) OR (max_round = ? AND last_round_clear_turn = ? AND remaining_hp > ?) OR (max_round = ? AND last_round_clear_turn = ? AND remaining_hp = ? AND created_at < ?)`).bind(best.max_round, best.max_round, best.last_round_clear_turn, best.max_round, best.last_round_clear_turn, best.remaining_hp, best.max_round, best.last_round_clear_turn, best.remaining_hp, best.created_at).first<{ rank: number }>();
    return scoreJson({ rank: rankRow?.rank ?? null, score: best });
  } catch { return scoreJson({ error: "Score service unavailable" }, 503); }
};

export const get9GridRanking = async (env: ScoreEnv, limit = 20): Promise<Response> => {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), SCORE_LIMIT);
  try {
    const result = await dbForScores(env).prepare(`SELECT s.id, s.account_user_id, u.nickname, s.max_round, s.last_round_clear_turn, s.remaining_hp, s.created_at FROM "9grid_scores" s INNER JOIN users u ON u.id = s.account_user_id ORDER BY s.max_round DESC, s.last_round_clear_turn ASC, s.remaining_hp DESC, s.created_at ASC LIMIT ?`).bind(safeLimit).all();
    return scoreJson({ scores: result.results });
  } catch { return scoreJson({ error: "Score service unavailable" }, 503); }
};

export const require9GridUser = async (request: Request, env: ScoreEnv): Promise<AuthUser | null> => getAuthenticatedUser(request, env.DB, "kakao_account_session");
