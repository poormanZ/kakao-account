import { describe, expect, it } from "vitest";
import { handleEscapeRoomAnswer } from "./escape-room-api";

const env = (key?: string) => ({ ESCAPE_ROOM_KEY_1_1: key }) as never;
const request = (body: unknown, contentType = "application/json") => new Request("https://example.com/api/games/escape-room/answer", {
  method: "POST",
  headers: { "Content-Type": contentType },
  body: JSON.stringify(body),
});

describe("Escape Room 1-1", () => {
  it("requires the configured server secret", async () => {
    const response = await handleEscapeRoomAnswer(request({ id: "PRIME", password: "235711" }), env());
    expect(response.status).toBe(503);
  });

  it("accepts the correct parallel ID and password", async () => {
    const response = await handleEscapeRoomAnswer(
      request({ id: "prime", password: "235711" }),
      env("PRIME|235711"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ correct: true, step: 1 });
  });

  it("rejects an incorrect pair without revealing the expected answer", async () => {
    const response = await handleEscapeRoomAnswer(
      request({ id: "PRIME", password: "235710" }),
      env("PRIME|235711"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ correct: false, message: "ACCESS DENIED" });
  });

  it("rejects malformed input", async () => {
    const response = await handleEscapeRoomAnswer(
      request({ id: "PRIME", password: "123" }),
      env("PRIME|235711"),
    );
    expect(response.status).toBe(400);
  });
});
