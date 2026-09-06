import { validateClickRushSubmission, type ValidatedClickRushScore } from "./click-rush-score";
import type { AuthUser } from "./auth";

interface ScoreRow {
  score: number;
  clicks: number;
  misses: number;
  max_combo: number;
  created_at: string;
}

interface RankingRow {
  rank: number;
  nickname: string;
  score: number;
  created_at: string;
}

const json = (data: unknown, status = 200): Response => Response.json(data, {
  status,
  headers: {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

const isConstraintError = (error: unknown): boolean => error instanceof Error && /constraint|check/i.test(error.message);

export const submitClickRushScore = async (
  db: D1Database,
  user: AuthUser | null,
  body: unknown,
): Promise<Response> => {
  if (!user) return json({ error: "Unauthorized" }, 401);
  const submission = validateClickRushSubmission(body);
  if (!submission) return json({ error: "Invalid score submission" }, 400);

  try {
    await db.prepare(
      `INSERT INTO game_scores
       (game_slug, account_user_id, duration_seconds, score, clicks, misses, max_combo, combo5_count, combo10_count, combo20_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      "click-rush",
      user.id,
      submission.duration_seconds,
      submission.score,
      submission.clicks,
      submission.misses,
      submission.max_combo,
      submission.combo5_count,
      submission.combo10_count,
      submission.combo20_count,
    ).run();

    const best = await db.prepare(
      `SELECT score, clicks, misses, max_combo, created_at
       FROM game_scores
       WHERE game_slug = ? AND account_user_id = ? AND duration_seconds = ?
       ORDER BY score DESC, created_at ASC LIMIT 1`,
    ).bind("click-rush", user.id, submission.duration_seconds).first<ScoreRow>();

    return json({
      game: "click-rush",
      duration_seconds: submission.duration_seconds,
      score: submission.score,
      is_personal_best: best?.score === submission.score && best.clicks === submission.clicks && best.misses === submission.misses && best.max_combo === submission.max_combo,
    });
  } catch (error) {
    if (isConstraintError(error)) return json({ error: "Invalid score submission" }, 400);
    return json({ error: "Score service unavailable" }, 503);
  }
};

export const getClickRushBest = async (
  db: D1Database,
  user: AuthUser | null,
  duration: number,
): Promise<Response> => {
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (![60, 180, 300].includes(duration)) return json({ error: "Invalid duration" }, 400);
  const best = await db.prepare(
    `SELECT score, clicks, misses, max_combo, created_at
     FROM game_scores
     WHERE game_slug = ? AND account_user_id = ? AND duration_seconds = ?
     ORDER BY score DESC, created_at ASC LIMIT 1`,
  ).bind("click-rush", user.id, duration).first<ScoreRow>();
  return json({ duration_seconds: duration, best: best ?? null });
};

export const getClickRushRanking = async (db: D1Database, duration: number): Promise<Response> => {
  if (![60, 180, 300].includes(duration)) return json({ error: "Invalid duration" }, 400);
  const rows = await db.prepare(
    `SELECT u.nickname, MAX(gs.score) AS score, MIN(gs.created_at) AS created_at
     FROM game_scores gs JOIN users u ON u.id = gs.account_user_id
     WHERE gs.game_slug = ? AND gs.duration_seconds = ?
     GROUP BY gs.account_user_id
     ORDER BY score DESC, created_at ASC LIMIT 100`,
  ).bind("click-rush", duration).all<{ nickname: string | null; score: number; created_at: string }>();

  const ranking: RankingRow[] = (rows.results ?? []).map((row, index) => ({
    rank: index + 1,
    nickname: row.nickname || "이름 없음",
    score: row.score,
    created_at: row.created_at,
  }));
  return json({ game: "click-rush", duration_seconds: duration, ranking });
};

export const getClickRushUserRank = async (db: D1Database, user: AuthUser | null, duration: number): Promise<Response> => {
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (![60, 180, 300].includes(duration)) return json({ error: "Invalid duration" }, 400);
  const best = await db.prepare(
    `SELECT MAX(score) AS score
     FROM game_scores WHERE game_slug = ? AND account_user_id = ? AND duration_seconds = ?`,
  ).bind("click-rush", user.id, duration).first<{ score: number | null }>();
  if (best?.score == null) return json({ duration_seconds: duration, rank: null, score: null });
  const rank = await db.prepare(
    `SELECT COUNT(*) + 1 AS rank
     FROM (
       SELECT account_user_id, MAX(score) AS best_score
       FROM game_scores
       WHERE game_slug = ? AND duration_seconds = ?
       GROUP BY account_user_id
     ) ranked
     WHERE best_score > ?`,
  ).bind("click-rush", duration, best.score).first<{ rank: number }>();
  return json({ duration_seconds: duration, rank: rank?.rank ?? null, score: best.score });
};

export const scoreForResponse = (submission: ValidatedClickRushScore): number => submission.score;
