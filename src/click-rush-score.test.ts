import { describe, expect, it } from "vitest";
import { calculateClickRushScore, validateClickRushSubmission } from "./click-rush-score";

describe("Click Rush score validation", () => {
  it("reproduces the client score from audited combo milestones", () => {
    const submission = {
      duration_seconds: 60,
      clicks: 20,
      misses: 2,
      max_combo: 20,
      combo5_count: 1,
      combo10_count: 1,
      combo20_count: 1,
    };
    expect(calculateClickRushScore(submission)).toBe(266);
    expect(validateClickRushSubmission(submission)?.score).toBe(266);
  });

  it("rejects an unsupported duration", () => {
    expect(validateClickRushSubmission({
      duration_seconds: 30, clicks: 1, misses: 0, max_combo: 1,
      combo5_count: 0, combo10_count: 0, combo20_count: 0,
    })).toBeNull();
  });

  it("rejects impossible combo milestone counts", () => {
    expect(validateClickRushSubmission({
      duration_seconds: 60, clicks: 10, misses: 0, max_combo: 10,
      combo5_count: 3, combo10_count: 1, combo20_count: 0,
    })).toBeNull();
  });

  it("rejects click rates above the server safety limit", () => {
    expect(validateClickRushSubmission({
      duration_seconds: 60, clicks: 1801, misses: 0, max_combo: 1801,
      combo5_count: 360, combo10_count: 180, combo20_count: 90,
    })).toBeNull();
  });
});
