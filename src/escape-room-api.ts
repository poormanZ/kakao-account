import type { Env } from "./index";

const normalize = (value: unknown): string => (
  typeof value === "string" ? value.trim() : ""
);

const normalizeId = (value: unknown): string => normalize(value).toUpperCase();

type EscapeRoomEnv = Env & { ESCAPE_ROOM_KEY_1_1?: string };

type AnswerBody = {
  id?: unknown;
  password?: unknown;
};

const parseBody = async (request: Request): Promise<AnswerBody | null> => {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return null;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as AnswerBody;
  } catch {
    return null;
  }
};

export const handleEscapeRoomAnswer = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  const escapeRoomEnv = env as EscapeRoomEnv;
  const configuredKey = normalize(escapeRoomEnv.ESCAPE_ROOM_KEY_1_1);
  if (!configuredKey) {
    return Response.json({ error: "Escape Room is not configured" }, { status: 503 });
  }

  const body = await parseBody(request);
  if (!body) return Response.json({ error: "JSON body required" }, { status: 415 });

  const id = normalizeId(body.id);
  const password = normalize(body.password);
  if (!/^[A-Z]{5}$/.test(id) || !/^\d{6}$/.test(password)) {
    return Response.json({ error: "Invalid answer format" }, { status: 400 });
  }

  const expected = configuredKey.split("|", 2);
  const expectedId = normalizeId(expected[0]);
  const expectedPassword = normalize(expected[1]);
  const correct = expected.length === 2 && id === expectedId && password === expectedPassword;

  return Response.json({
    correct,
    ...(correct ? { step: 1, message: "ACCESS GRANTED", next: "/escape-room?step=2" } : { message: "ACCESS DENIED" }),
  });
};
