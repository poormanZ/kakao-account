import { getAuthenticatedUser, type AuthUser } from "./auth";
import { load9GridSession } from "./9grid-session";

export type ScoreEnv = { DB: D1Database; GAME_DB?: D1Database; };
export interface NineGridScore {
  id: number;
  account_user_id: number;
  score: number;
  max_round: number;
  last_round_clear_at: string;
}
type ScoreRow = NineGridScore;
const SCORE_LIMIT = 100;
const SCORE_PER_ROUND = 1000;
const dbForScores = (env: ScoreEnv): D1Database => env.DB;
const scoreJson = (data: unknown, status = 200): Response => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

export const calculate9GridScore = (maxRound: number): number => {
  if (!Number.isInteger(maxRound) || maxRound < 0) throw new Error("Invalid cleared round");
  return maxRound * SCORE_PER_ROUND;
};

export const save9GridScore = async (_request: Request, env: ScoreEnv, user: AuthUser): Promise<Response> => {
  try {
    const state = await load9GridSession(env, user.id);
    if (!state) return scoreJson({ error: "9Grid session not found" }, 404);
    if (!state.gameOver || state.round.phase !== "game_over") return scoreJson({ error: "Game is not over" }, 409);
    const score = calculate9GridScore(state.maxClearedRound);
    const clearAt = state.lastRoundClearAt ?? new Date().toISOString();
    await dbForScores(env)
      .prepare(`INSERT INTO "9grid_scores" (account_user_id, max_round, last_round_clear_turn, remaining_hp, score, last_round_clear_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(user.id, state.maxClearedRound, state.lastRoundClearTurn, state.round.playerHp, score, clearAt)
      .run();
    return scoreJson({ saved: true, score: { score, max_round: state.maxClearedRound, last_round_clear_at: clearAt } });
  } catch {
    return scoreJson({ error: "Score service unavailable" }, 503);
  }
};

export const get9GridBestScore = async (env: ScoreEnv, user: AuthUser): Promise<Response> => {
  try {
    const row = await dbForScores(env).prepare(`SELECT id, account_user_id, score, max_round, last_round_clear_at FROM "9grid_scores" WHERE account_user_id = ? ORDER BY score DESC, last_round_clear_at ASC, id ASC LIMIT 1`).bind(user.id).first<ScoreRow>();
    return scoreJson({ score: row ?? null });
  } catch { return scoreJson({ error: "Score service unavailable" }, 503); }
};

export const get9GridMyRank = async (env: ScoreEnv, user: AuthUser): Promise<Response> => {
  try {
    const best = await dbForScores(env).prepare(`SELECT score, max_round, last_round_clear_at FROM "9grid_scores" WHERE account_user_id = ? ORDER BY score DESC, last_round_clear_at ASC, id ASC LIMIT 1`).bind(user.id).first<Pick<NineGridScore, "score" | "max_round" | "last_round_clear_at">>();
    if (!best) return scoreJson({ rank: null, score: null });
    const rankRow = await dbForScores(env).prepare(`SELECT COUNT(*) + 1 AS rank FROM "9grid_scores" WHERE score > ? OR (score = ? AND last_round_clear_at < ?)`).bind(best.score, best.score, best.last_round_clear_at).first<{ rank: number }>();
    return scoreJson({ rank: rankRow?.rank ?? null, score: best });
  } catch { return scoreJson({ error: "Score service unavailable" }, 503); }
};

export const get9GridRanking = async (env: ScoreEnv, limit = 20): Promise<Response> => {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), SCORE_LIMIT);
  try {
    const result = await dbForScores(env).prepare(`SELECT s.id, s.account_user_id, u.nickname, s.score, s.max_round, s.last_round_clear_at FROM "9grid_scores" s INNER JOIN users u ON u.id = s.account_user_id ORDER BY s.score DESC, s.last_round_clear_at ASC, s.id ASC LIMIT ?`).bind(safeLimit).all();
    return scoreJson({ scores: result.results });
  } catch { return scoreJson({ error: "Score service unavailable" }, 503); }
};

export const require9GridUser = async (request: Request, env: ScoreEnv): Promise<AuthUser | null> => getAuthenticatedUser(request, env.DB, "kakao_account_session");
