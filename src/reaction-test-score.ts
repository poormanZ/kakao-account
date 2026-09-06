export const REACTION_TEST_ROUNDS = 5;
export const REACTION_TEST_MIN_SUCCESSFUL_ROUNDS = 3;
export const REACTION_TEST_MIN_MS = 100;
export const REACTION_TEST_MAX_MS = 1500;

export interface ReactionTestSubmission {
  round_count: number;
  successful_rounds: number;
  reaction_times: number[];
  false_starts: number;
  timeouts: number;
}

export interface ReactionTestResult {
  average_ms: number;
  best_ms: number;
  successful_rounds: number;
  false_starts: number;
  timeouts: number;
}

export function validateReactionTestSubmission(
  value: unknown,
): ReactionTestSubmission {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_payload");
  }

  const input = value as Partial<ReactionTestSubmission>;
  const roundCount = input.round_count;
  const successfulRounds = input.successful_rounds;
  const falseStarts = input.false_starts;
  const timeouts = input.timeouts;
  const reactionTimes = input.reaction_times;

  if (
    !Number.isInteger(roundCount) ||
    roundCount !== REACTION_TEST_ROUNDS ||
    !Number.isInteger(successfulRounds) ||
    !Number.isInteger(falseStarts) ||
    !Number.isInteger(timeouts) ||
    successfulRounds < REACTION_TEST_MIN_SUCCESSFUL_ROUNDS ||
    successfulRounds > REACTION_TEST_ROUNDS ||
    falseStarts < 0 ||
    timeouts < 0 ||
    successfulRounds + falseStarts + timeouts !== REACTION_TEST_ROUNDS
  ) {
    throw new Error("invalid_round_summary");
  }

  if (
    !Array.isArray(reactionTimes) ||
    reactionTimes.length !== successfulRounds ||
    reactionTimes.some(
      (time) =>
        !Number.isInteger(time) ||
        time < REACTION_TEST_MIN_MS ||
        time > REACTION_TEST_MAX_MS,
    )
  ) {
    throw new Error("invalid_reaction_times");
  }

  return {
    round_count: roundCount,
    successful_rounds: successfulRounds,
    reaction_times: reactionTimes,
    false_starts: falseStarts,
    timeouts,
  };
}

export function calculateReactionTestResult(
  submission: ReactionTestSubmission,
): ReactionTestResult {
  const valid = validateReactionTestSubmission(submission);
  const total = valid.reaction_times.reduce((sum, time) => sum + time, 0);
  const averageMs = Math.round(total / valid.reaction_times.length);
  const bestMs = Math.min(...valid.reaction_times);

  return {
    average_ms: averageMs,
    best_ms: bestMs,
    successful_rounds: valid.successful_rounds,
    false_starts: valid.false_starts,
    timeouts: valid.timeouts,
  };
}

export function getReactionTestGrade(averageMs: number): string {
  if (averageMs < 200) return "PERFECT";
  if (averageMs < 250) return "EXCELLENT";
  if (averageMs < 300) return "GREAT";
  if (averageMs < 400) return "GOOD";
  return "SLOW";
}
