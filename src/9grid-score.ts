import { getAuthenticatedUser, type AuthUser } from "./auth";
import { load9GridSession } from "./9grid-session";

export type ScoreEnv = { DB: D1Database; GAME_DB?: D1Database; };
export interface NineGridScore { id: number; account_user_id: number; max_round: number; last_round_clear_turn: number; remaining_hp: number; created_at: string; }
type ScoreRow = NineGridScore;
const SCORE_LIMIT = 100;
const dbForScores = (env: ScoreEnv): D1Database => env.DB;
const scoreJson = (data: unknown, status = 200): Response => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export const save9GridScore = async (_request: Request, env: ScoreEnv, user: AuthUser): Promise<Response> => {
  try {
    const state = await load9GridSession(env, user.id);
    if (!state) return scoreJson({ error: "9Grid session not found" }, 404);
    if (!state.gameOver || state.round.phase !== "game_over") return scoreJson({ error: "Game is not over" }, 409);
    await dbForScores(env)
      .prepare(`INSERT INTO "9grid_scores" (account_user_id, max_round, last_round_clear_turn, remaining_hp) VALUES (?, ?, ?, ?)`)
      .bind(user.id, state.maxClearedRound, state.lastRoundClearTurn, state.round.playerHp)
      .run();
    return scoreJson({ saved: true, score: { max_round: state.maxClearedRound, last_round_clear_turn: state.lastRoundClearTurn, remaining_hp: state.round.playerHp } });
  } catch {
    return scoreJson({ error: "Score service unavailable" }, 503);
  }
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
