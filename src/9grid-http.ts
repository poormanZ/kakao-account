import { createInitialState, type GameState } from "./9grid";
import {
  applyNineGridAction,
  createDefaultCardGenerator,
  parseNineGridAction,
  type NineGridAction,
} from "./9grid-api";
import {
  load9GridSession,
  save9GridSession,
  type NineGridSessionEnv,
} from "./9grid-session";

export interface NineGridHttpEnv extends NineGridSessionEnv {
  NINEGRID_MONSTER_ATTACK?: string;
}

const json = (data: unknown, status = 200): Response =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

const parseBody = async (request: Request): Promise<unknown | null> => {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const getMonsterAttack = (env: NineGridHttpEnv): number | undefined => {
  if (env.NINEGRID_MONSTER_ATTACK === undefined) return undefined;
  const value = Number(env.NINEGRID_MONSTER_ATTACK);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};

const applyAction = (state: GameState, action: NineGridAction, env: NineGridHttpEnv): GameState =>
  applyNineGridAction(state, action, {
    generateCards: createDefaultCardGenerator(),
    monsterAttack: getMonsterAttack(env),
  });

export const handleNineGridSession = async (
  request: Request,
  env: NineGridHttpEnv,
  userId: number,
): Promise<Response> => {
  if (!Number.isInteger(userId) || userId <= 0) return json({ error: "Unauthorized" }, 401);

  if (request.method === "GET") {
    try {
      const state = await load9GridSession(env, userId);
      return json({ state });
    } catch {
      return json({ error: "9Grid session unavailable" }, 503);
    }
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const body = await parseBody(request);
  if (body === null) return json({ error: "Invalid JSON body" }, 400);

  let action: NineGridAction;
  try {
    action = parseNineGridAction(body);
  } catch {
    return json({ error: "Invalid 9Grid action" }, 400);
  }

  try {
    const storedState = await load9GridSession(env, userId);
    if (storedState === null && action.type !== "start") {
      return json({ error: "9Grid session not found" }, 404);
    }

    const state = storedState ?? createInitialState();
    const nextState = applyAction(state, action, env);
    await save9GridSession(env, userId, nextState);
    return json({ state: nextState });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid ")) {
      return json({ error: "Invalid 9Grid state transition" }, 400);
    }
    return json({ error: "9Grid session unavailable" }, 503);
  }
};
