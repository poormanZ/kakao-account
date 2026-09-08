import { createInitialState, type GameState } from "./9grid";
import {
  applyNineGridAction,
  createDefaultCardGenerator,
  parseNineGridAction,
  parseNineGridActionId,
  type NineGridAction,
} from "./9grid-api";
import { getMonsterAttack as getRoundMonsterAttack } from "./9grid-balance";
import {
  create9GridSession,
  isGameState,
  load9GridSession,
  load9GridSessionRecord,
  NineGridSessionConflictError,
  update9GridSession,
  type NineGridSessionEnv,
} from "./9grid-session";

export interface NineGridHttpEnv extends NineGridSessionEnv { NINEGRID_MONSTER_ATTACK?: string; }
export type NineGridSessionRoute = "session" | "action";

const json = (data: unknown, status = 200): Response => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

const parseBody = async (request: Request): Promise<unknown | null> => {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return null;
  try { return await request.json(); } catch { return null; }
};

const isSameOrigin = (request: Request): boolean => {
  const origin = request.headers.get("Origin");
  if (origin === null) return true;
  try { return origin === new URL(request.url).origin; } catch { return false; }
};

const getMonsterAttack = (env: NineGridHttpEnv, round: number): number => {
  if (env.NINEGRID_MONSTER_ATTACK === undefined) return getRoundMonsterAttack(round);
  const value = Number(env.NINEGRID_MONSTER_ATTACK);
  return Number.isFinite(value) && value >= 0 ? value : getRoundMonsterAttack(round);
};

const applyAction = (state: GameState, action: NineGridAction, env: NineGridHttpEnv): GameState =>
  applyNineGridAction(state, action, {
    generateCards: createDefaultCardGenerator(),
    monsterAttack: getMonsterAttack(env, state.round.round),
  });

const parseStoredResponse = (value: string): { state: GameState; monsterAttack: number } | null => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (!isGameState(record.state) || typeof record.monsterAttack !== "number" || !Number.isFinite(record.monsterAttack)) return null;
    return { state: record.state, monsterAttack: record.monsterAttack };
  } catch { return null; }
};

export const handleNineGridSession = async (
  request: Request,
  env: NineGridHttpEnv,
  userId: number,
  route: NineGridSessionRoute,
): Promise<Response> => {
  if (!Number.isInteger(userId) || userId <= 0) return json({ error: "Unauthorized" }, 401);
  if (route === "session") {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    try {
      const state = await load9GridSession(env, userId);
      return json({ state, monsterAttack: getMonsterAttack(env, state?.round.round ?? 1) });
    } catch { return json({ error: "9Grid session unavailable" }, 503); }
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isSameOrigin(request)) return json({ error: "Cross-site request rejected" }, 403);
  const body = await parseBody(request);
  if (body === null || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid JSON body" }, 400);

  const { actionId: rawActionId, ...actionBody } = body as Record<string, unknown>;
  let actionId: string;
  let action: NineGridAction;
  try {
    actionId = parseNineGridActionId(rawActionId);
    action = parseNineGridAction(actionBody);
  } catch {
    return json({ error: "Invalid 9Grid action" }, 400);
  }

  try {
    const stored = await load9GridSessionRecord(env, userId);
    if (stored?.lastActionId === actionId && stored.lastActionResponseJson !== null) {
      const replay = parseStoredResponse(stored.lastActionResponseJson);
      if (replay !== null) return json({ ...replay, actionId, version: stored.version });
      return json({ error: "9Grid session unavailable" }, 503);
    }
    if (stored === null && action.type !== "start") return json({ error: "9Grid session not found" }, 404);
    const state = stored?.state ?? createInitialState();
    const nextState = applyAction(state, action, env);
    const responseBody = {
      state: nextState,
      monsterAttack: getMonsterAttack(env, nextState.round.round),
    };
    const responseJson = JSON.stringify(responseBody);
    const saved = stored === null
      ? await create9GridSession(env, userId, nextState, actionId, responseJson)
      : await update9GridSession(env, userId, nextState, stored.version, actionId, responseJson);
    return json({ ...responseBody, actionId, version: saved.version });
  } catch (error) {
    if (error instanceof NineGridSessionConflictError) return json({ error: "9Grid session changed; retry the action" }, 409);
    if (error instanceof Error && error.message.startsWith("Invalid ")) return json({ error: "Invalid 9Grid state transition" }, 400);
    return json({ error: "9Grid session unavailable" }, 503);
  }
};
