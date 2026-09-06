export const CLICK_RUSH_DURATIONS = [20, 40, 60] as const;
export type ClickRushDuration = (typeof CLICK_RUSH_DURATIONS)[number];

export interface ClickRushSubmission {
  duration_seconds: number;
  clicks: number;
  misses: number;
  max_combo: number;
  combo5_count: number;
  combo10_count: number;
  combo20_count: number;
}

export interface ValidatedClickRushScore extends ClickRushSubmission {
  score: number;
}

const isInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

export const calculateClickRushScore = (submission: ClickRushSubmission): number => Math.max(
  0,
  submission.clicks * 10 - submission.misses * 2
    + submission.combo5_count * 10
    + submission.combo10_count * 20
    + submission.combo20_count * 40,
);

export const validateClickRushSubmission = (value: unknown): ValidatedClickRushScore | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const duration = input.duration_seconds;
  const clicks = input.clicks;
  const misses = input.misses;
  const maxCombo = input.max_combo;
  const combo5 = input.combo5_count;
  const combo10 = input.combo10_count;
  const combo20 = input.combo20_count;

  if (!isInteger(duration) || !CLICK_RUSH_DURATIONS.includes(duration as ClickRushDuration)) return null;
  if (![clicks, misses, maxCombo, combo5, combo10, combo20].every(isInteger)) return null;

  const numeric = [clicks, misses, maxCombo, combo5, combo10, combo20] as number[];
  const [clickCount, missCount, comboMax, combo5Count, combo10Count, combo20Count] = numeric;
  if (numeric.some((item) => item < 0)) return null;
  if (clickCount > duration * 30 || missCount > duration * 30) return null;
  if (comboMax > clickCount) return null;
  if (combo10Count > combo5Count || combo20Count > combo10Count) return null;
  if (combo5Count > Math.floor(clickCount / 5)) return null;
  if (combo10Count > Math.floor(clickCount / 10)) return null;
  if (combo20Count > Math.floor(clickCount / 20)) return null;

  const submission: ClickRushSubmission = {
    duration_seconds: duration,
    clicks: clickCount,
    misses: missCount,
    max_combo: comboMax,
    combo5_count: combo5Count,
    combo10_count: combo10Count,
    combo20_count: combo20Count,
  };
  return { ...submission, score: calculateClickRushScore(submission) };
};
