import { validateClickRushSubmission, type ValidatedClickRushScore } from "./click-rush-score";
import type { AuthUser } from "./auth";

const CLICK_RUSH_DURATIONS = [20, 40, 60];

interface ScoreRow {
  score: number;
  clicks: number;
  misses: number;
  max_combo: number;
  created_at: string;
}

interface RankingScoreRow {
  account_user_id: number;
  score: number;
  created_at: string;
}

interface RankingUserRow {
  id: number;
  nickname: string | null;
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
  db: D1Database | undefined,
  user: AuthUser | null,
  body: unknown,
): Promise<Response> => {
  if (!user) return json({ error: "Unauthorized" }, 401);
  const submission = validateClickRushSubmission(body);
  if (!submission) return json({ error: "Invalid score submission" }, 400);
  if (!db) return json({ error: "Game service unavailable" }, 503);

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
  db: D1Database | undefined,
  user: AuthUser | null,
  duration: number,
): Promise<Response> => {
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!CLICK_RUSH_DURATIONS.includes(duration)) return json({ error: "Invalid duration" }, 400);
  if (!db) return json({ error: "Game service unavailable" }, 503);
  const best = await db.prepare(
    `SELECT score, clicks, misses, max_combo, created_at
     FROM game_scores
     WHERE game_slug = ? AND account_user_id = ? AND duration_seconds = ?
     ORDER BY score DESC, created_at ASC LIMIT 1`,
  ).bind("click-rush", user.id, duration).first<ScoreRow>();
  return json({ duration_seconds: duration, best: best ?? null });
};

export const getClickRushRanking = async (
  gameDb: D1Database | undefined,
  accountDb: D1Database,
  duration: number,
): Promise<Response> => {
  if (!CLICK_RUSH_DURATIONS.includes(duration)) return json({ error: "Invalid duration" }, 400);
  if (!gameDb) return json({ error: "Game service unavailable" }, 503);

  try {
    const rows = await gameDb.prepare(
      `SELECT account_user_id, MAX(score) AS score, MIN(created_at) AS created_at
       FROM game_scores
       WHERE game_slug = ? AND duration_seconds = ?
       GROUP BY account_user_id
       ORDER BY score DESC, created_at ASC LIMIT 100`,
    ).bind("click-rush", duration).all<RankingScoreRow>();

    const scoreRows = rows.results ?? [];
    if (scoreRows.length === 0) return json({ game: "click-rush", duration_seconds: duration, ranking: [] });

    const placeholders = scoreRows.map(() => "?").join(", ");
    const users = await accountDb.prepare(
      `SELECT id, nickname FROM users WHERE id IN (${placeholders})`,
    ).bind(...scoreRows.map((row) => row.account_user_id)).all<RankingUserRow>();
    const userMap = new Map((users.results ?? []).map((row) => [row.id, row.nickname]));

    const ranking: RankingRow[] = scoreRows.map((row, index) => ({
      rank: index + 1,
      nickname: userMap.get(row.account_user_id) || "이름 없음",
      score: row.score,
      created_at: row.created_at,
    }));
    return json({ game: "click-rush", duration_seconds: duration, ranking });
  } catch {
    return json({ error: "Ranking service unavailable" }, 503);
  }
};

export const getClickRushUserRank = async (db: D1Database | undefined, user: AuthUser | null, duration: number): Promise<Response> => {
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!CLICK_RUSH_DURATIONS.includes(duration)) return json({ error: "Invalid duration" }, 400);
  if (!db) return json({ error: "Game service unavailable" }, 503);
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
