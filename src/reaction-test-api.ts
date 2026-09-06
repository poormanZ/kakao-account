import { validateReactionTestSubmission, calculateReactionTestResult, type ReactionTestResult } from "./reaction-test-score";
import type { AuthUser } from "./auth";

interface ScoreRow extends ReactionTestResult { created_at: string; }
interface RankingScoreRow extends ScoreRow { account_user_id: number; }
interface RankingUserRow { id: number; nickname: string | null; }
interface RankingRow { rank: number; nickname: string; average_ms: number; best_ms: number; successful_rounds: number; created_at: string; }

const json = (data: unknown, status = 200): Response => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const isConstraintError = (error: unknown): boolean => error instanceof Error && /constraint|check/i.test(error.message);

export const submitReactionTestScore = async (db: D1Database | undefined, user: AuthUser | null, body: unknown): Promise<Response> => {
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!db) return json({ error: "Game service unavailable" }, 503);
  try {
    const submission = validateReactionTestSubmission(body);
    const result = calculateReactionTestResult(submission);
    const previous = await db.prepare("SELECT average_ms FROM reaction_test_scores WHERE account_user_id = ? ORDER BY average_ms ASC, created_at ASC, id ASC LIMIT 1").bind(user.id).first<{ average_ms: number }>();
    await db.prepare(`INSERT INTO reaction_test_scores (account_user_id, average_ms, best_ms, successful_rounds, false_starts, timeouts, round_times_json) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(user.id, result.average_ms, result.best_ms, result.successful_rounds, result.false_starts, result.timeouts, JSON.stringify(submission.reaction_times)).run();
    return json({ game: "reaction", average_ms: result.average_ms, best_ms: result.best_ms, is_personal_best: !previous || result.average_ms < previous.average_ms });
  } catch (error) {
    if (error instanceof Error && /invalid_/.test(error.message)) return json({ error: "Invalid reaction test submission" }, 400);
    if (isConstraintError(error)) return json({ error: "Invalid reaction test submission" }, 400);
    return json({ error: "Score service unavailable" }, 503);
  }
};

export const getReactionTestBest = async (db: D1Database | undefined, user: AuthUser | null): Promise<Response> => {
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!db) return json({ error: "Game service unavailable" }, 503);
  const best = await db.prepare("SELECT average_ms, best_ms, successful_rounds, false_starts, timeouts, created_at FROM reaction_test_scores WHERE account_user_id = ? ORDER BY average_ms ASC, created_at ASC, id ASC LIMIT 1").bind(user.id).first<ScoreRow>();
  return json({ game: "reaction", best: best ?? null });
};

export const getReactionTestUserRank = async (db: D1Database | undefined, user: AuthUser | null): Promise<Response> => {
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!db) return json({ error: "Game service unavailable" }, 503);
  const best = await db.prepare("SELECT average_ms, created_at FROM reaction_test_scores WHERE account_user_id = ? ORDER BY average_ms ASC, created_at ASC, id ASC LIMIT 1").bind(user.id).first<{ average_ms: number; created_at: string }>();
  if (!best) return json({ game: "reaction", rank: null, average_ms: null });
  const rank = await db.prepare(`WITH ranked AS (SELECT account_user_id, average_ms, created_at, ROW_NUMBER() OVER (PARTITION BY account_user_id ORDER BY average_ms ASC, created_at ASC, id ASC) AS rn FROM reaction_test_scores), best_scores AS (SELECT account_user_id, average_ms, created_at FROM ranked WHERE rn = 1) SELECT COUNT(*) + 1 AS rank FROM best_scores WHERE average_ms < ? OR (average_ms = ? AND created_at < ?) OR (average_ms = ? AND created_at = ? AND account_user_id < ?)`).bind(best.average_ms, best.average_ms, best.created_at, best.average_ms, best.created_at, user.id).first<{ rank: number }>();
  return json({ game: "reaction", rank: rank?.rank ?? null, average_ms: best.average_ms });
};

export const getReactionTestRanking = async (gameDb: D1Database | undefined, accountDb: D1Database): Promise<Response> => {
  if (!gameDb) return json({ error: "Game service unavailable" }, 503);
  try {
    const rows = await gameDb.prepare(`WITH ranked AS (SELECT account_user_id, average_ms, best_ms, successful_rounds, false_starts, timeouts, created_at, ROW_NUMBER() OVER (PARTITION BY account_user_id ORDER BY average_ms ASC, created_at ASC, id ASC) AS rn FROM reaction_test_scores) SELECT account_user_id, average_ms, best_ms, successful_rounds, false_starts, timeouts, created_at FROM ranked WHERE rn = 1 ORDER BY average_ms ASC, created_at ASC, account_user_id ASC LIMIT 100`).all<RankingScoreRow>();
    const scoreRows = rows.results ?? [];
    if (scoreRows.length === 0) return json({ game: "reaction", ranking: [] });
    const placeholders = scoreRows.map(() => "?").join(", ");
    const users = await accountDb.prepare(`SELECT id, nickname FROM users WHERE id IN (${placeholders})`).bind(...scoreRows.map((row) => row.account_user_id)).all<RankingUserRow>();
    const userMap = new Map((users.results ?? []).map((row) => [row.id, row.nickname]));
    const ranking: RankingRow[] = scoreRows.map((row, index) => ({ rank: index + 1, nickname: userMap.get(row.account_user_id) || "이름 없음", average_ms: row.average_ms, best_ms: row.best_ms, successful_rounds: row.successful_rounds, created_at: row.created_at }));
    return json({ game: "reaction", ranking });
  } catch { return json({ error: "Ranking service unavailable" }, 503); }
};
