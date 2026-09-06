import { describe, expect, it } from "vitest";
import {
  calculateReactionTestResult,
  getReactionTestGrade,
  validateReactionTestSubmission,
} from "./reaction-test-score";

const validSubmission = {
  round_count: 5,
  successful_rounds: 5,
  reaction_times: [180, 220, 260, 320, 410],
  false_starts: 0,
  timeouts: 0,
};

describe("Reaction Test score validation", () => {
  it("accepts a complete five-round submission", () => {
    expect(validateReactionTestSubmission(validSubmission)).toEqual(validSubmission);
  });

  it("accepts three successful rounds with false starts and timeouts", () => {
    expect(validateReactionTestSubmission({
      round_count: 5,
      successful_rounds: 3,
      reaction_times: [180, 240, 300],
      false_starts: 1,
      timeouts: 1,
    })).toBeTruthy();
  });

  it("rejects a round count other than five", () => {
    expect(() => validateReactionTestSubmission({
      ...validSubmission,
      round_count: 4,
    })).toThrow("invalid_round_summary");
  });

  it("rejects fewer than three successful rounds", () => {
    expect(() => validateReactionTestSubmission({
      round_count: 5,
      successful_rounds: 2,
      reaction_times: [180, 240],
      false_starts: 1,
      timeouts: 2,
    })).toThrow("invalid_round_summary");
  });

  it("rejects a round summary that does not total five", () => {
    expect(() => validateReactionTestSubmission({
      round_count: 5,
      successful_rounds: 3,
      reaction_times: [180, 240, 300],
      false_starts: 0,
      timeouts: 0,
    })).toThrow("invalid_round_summary");
  });

  it("rejects reaction time arrays with the wrong length", () => {
    expect(() => validateReactionTestSubmission({
      ...validSubmission,
      reaction_times: [180, 220, 260, 320],
    })).toThrow("invalid_reaction_times");
  });

  it("rejects reaction times outside the server bounds", () => {
    expect(() => validateReactionTestSubmission({
      ...validSubmission,
      reaction_times: [99, 220, 260, 320, 410],
    })).toThrow("invalid_reaction_times");
    expect(() => validateReactionTestSubmission({
      ...validSubmission,
      reaction_times: [180, 220, 260, 320, 1501],
    })).toThrow("invalid_reaction_times");
  });

  it("calculates rounded average and best reaction time", () => {
    expect(calculateReactionTestResult(validSubmission)).toEqual({
      average_ms: 278,
      best_ms: 180,
      successful_rounds: 5,
      false_starts: 0,
      timeouts: 0,
    });
  });
});

describe("Reaction Test grades", () => {
  it.each([
    [199, "PERFECT"],
    [200, "EXCELLENT"],
    [249, "EXCELLENT"],
    [250, "GREAT"],
    [299, "GREAT"],
    [300, "GOOD"],
    [399, "GOOD"],
    [400, "SLOW"],
  ])("grades %i ms as %s", (averageMs, grade) => {
    expect(getReactionTestGrade(averageMs)).toBe(grade);
  });
});
