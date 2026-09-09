import type { Env } from "./index";

const normalizeKey = (value: unknown): string => (
  typeof value === "string" ? value.trim().toUpperCase() : ""
);

type EscapeRoomEnv = Env & { ESCAPE_ROOM_KEY_1_1?: string };

export const handleEscapeRoomAnswer = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return Response.json({ error: "JSON body required" }, { status: 415 });
  }

  const escapeRoomEnv = env as EscapeRoomEnv;
  if (!escapeRoomEnv.ESCAPE_ROOM_KEY_1_1) {
    return Response.json({ error: "Escape Room is not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const answer = normalizeKey((body as { answer?: unknown }).answer);
  if (!answer || answer.length > 32) {
    return Response.json({ error: "Invalid answer" }, { status: 400 });
  }

  const expected = normalizeKey(escapeRoomEnv.ESCAPE_ROOM_KEY_1_1);
  if (answer !== expected) {
    return Response.json({ correct: false, message: "ACCESS DENIED" }, { status: 200 });
  }

  return Response.json({
    correct: true,
    step: 1,
    message: "ACCESS GRANTED",
    next: "/escape-room?step=2",
  });
};
