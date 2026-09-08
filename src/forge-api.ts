import { getSellPrice, getWeaponDamage, resolveUpgrade, type ForgeGameState, type ForgeSkills, type ForgeWeapon } from "./forge";
import { commitForgeSessionAction, createForgeSession, loadForgeSession, type ForgeShopWeapon, type ForgeSessionRecord } from "./forge-session";
import { type AuthUser } from "./auth";

const SKILL_COSTS = { enhancementBonusLevel: 25, greatSuccessLevel: 50, sellBonusLevel: 30 } as const;
const MAX_SKILL_LEVEL = 20;
const WEAPON_BASE_DAMAGES = [1, 2, 4, 8] as const;
const WEAPON_NAMES = ["일반검", "철검", "강철검", "대장간검"] as const;
const ACTIONS = ["BUY_WEAPON", "UPGRADE", "SELL_WEAPON", "REFRESH_SHOP", "BUY_SKILL"] as const;
type ForgeAction = typeof ACTIONS[number];
type ForgeActionBody = { action: ForgeAction; actionId: string; version: number; weaponId?: string; skill?: keyof ForgeSkills };
const D1_BOOKMARK_HEADER = "X-D1-Bookmark";
const D1_BOOKMARK_COOKIE = "forge_d1_bookmark";

const isForgeAction = (value: unknown): value is ForgeAction => typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
const parseAction = (body: Record<string, unknown> | null): ForgeActionBody | null => {
  if (!body || !isForgeAction(body.action) || typeof body.actionId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(body.actionId)) return null;
  if (!Number.isInteger(body.version) || (body.version as number) <= 0) return null;
  if (body.weaponId !== undefined && (typeof body.weaponId !== "string" || body.weaponId.length > 100)) return null;
  const skills = ["enhancementBonusLevel", "greatSuccessLevel", "sellBonusLevel"] as const;
  if (body.skill !== undefined && !skills.includes(body.skill as typeof skills[number])) return null;
  return { action: body.action, actionId: body.actionId, version: body.version as number, weaponId: body.weaponId as string | undefined, skill: body.skill as keyof ForgeSkills | undefined };
};
const randomIndex = (length: number): number => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % length;
};
const randomRoll = (): number => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const createShopWeapon = (): ForgeShopWeapon => {
  const index = randomIndex(WEAPON_BASE_DAMAGES.length);
  const suffix = crypto.getRandomValues(new Uint32Array(2)).join("-");
  return { id: `forge-${Date.now().toString(36)}-${suffix}`, name: WEAPON_NAMES[index], baseDamage: WEAPON_BASE_DAMAGES[index], rarity: "common" };
};
const createShop = (): ForgeShopWeapon[] => [createShopWeapon(), createShopWeapon(), createShopWeapon()];
const responseState = (record: ForgeSessionRecord, lastAction?: unknown): Record<string, unknown> => ({
  gold: record.state.gold,
  currentWeapon: record.state.currentWeapon,
  currentDamage: record.state.currentWeapon ? getWeaponDamage(record.state.currentWeapon) : 0,
  shopWeapons: record.shopWeapons,
  skills: record.state.skills,
  version: record.version,
  ...(lastAction === undefined ? {} : { lastAction }),
});
const sameOrigin = (request: Request): boolean => {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
};
const getCookie = (request: Request, name: string): string | null => {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) {
      const value = valueParts.join("=");
      if (!value) return null;
      try { return decodeURIComponent(value); } catch { return null; }
    }
  }
  return null;
};
const isRecoverableSessionError = (error: unknown): boolean => error instanceof Error && error.message.startsWith("Stored forge ");
const setBookmark = (response: Response, db: D1DatabaseSession, request: Request): Response => {
  const bookmark = db.getBookmark();
  if (bookmark) {
    response.headers.set(D1_BOOKMARK_HEADER, bookmark);
    const secure = new URL(request.url).protocol === "https:";
    response.headers.append("Set-Cookie", `${D1_BOOKMARK_COOKIE}=${encodeURIComponent(bookmark)}; Max-Age=3600; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`);
  }
  return response;
};
const createForgeDbSession = (gameDb: D1Database, request: Request): D1DatabaseSession => {
  const headerBookmark = request.headers.get(D1_BOOKMARK_HEADER)?.trim();
  const bookmark = headerBookmark || getCookie(request, D1_BOOKMARK_COOKIE);
  return gameDb.withSession(bookmark || "first-primary");
};
const createForgeActionDbSession = (gameDb: D1Database): D1DatabaseSession => gameDb.withSession("first-primary");
const loadOrCreate = async (db: D1DatabaseSession, accountUserId: number): Promise<ForgeSessionRecord> => {
  try {
    const existing = await loadForgeSession(db, accountUserId);
    if (existing) return existing;
  } catch (error) {
    if (!isRecoverableSessionError(error)) throw error;
    await db.prepare("DELETE FROM forge_game_states WHERE account_user_id = ?").bind(accountUserId).run();
  }
  try {
    return await createForgeSession(db, accountUserId, createShop());
  } catch {
    const retry = await loadForgeSession(db, accountUserId);
    if (!retry) throw new Error("Failed to initialize forge session");
    return retry;
  }
};
const findShopWeapon = (shop: ForgeShopWeapon[], weaponId: string | undefined): ForgeShopWeapon | null => shop.find((weapon) => weapon.id === weaponId) ?? null;
const buyWeapon = (state: ForgeGameState, shop: ForgeShopWeapon[], weaponId: string | undefined): { state: ForgeGameState; shop: ForgeShopWeapon[]; result: Record<string, unknown> } => {
  const shopWeapon = findShopWeapon(shop, weaponId);
  if (!shopWeapon) throw new Error("Weapon not available");
  if (state.gold < shopWeapon.baseDamage) throw new Error("Insufficient gold");
  const purchased: ForgeWeapon = { ...shopWeapon, enhancementLevel: 0 };
  const nextShop = shop.map((weapon) => weapon.id === shopWeapon.id ? createShopWeapon() : weapon);
  return { state: { ...state, gold: state.gold - shopWeapon.baseDamage, currentWeapon: purchased }, shop: nextShop, result: { kind: "buy_weapon", weapon: purchased, cost: shopWeapon.baseDamage } };
};
const applySkill = (state: ForgeGameState, skill: keyof ForgeSkills | undefined): { state: ForgeGameState; result: Record<string, unknown> } => {
  if (!skill) throw new Error("Skill is required");
  const level = state.skills[skill];
  if (level >= MAX_SKILL_LEVEL) throw new Error("Skill is already maxed");
  const cost = SKILL_COSTS[skill] * 2 ** level;
  if (!Number.isSafeInteger(cost) || state.gold < cost) throw new Error("Insufficient gold");
  const skills = { ...state.skills, [skill]: level + 1 };
  return { state: { ...state, gold: state.gold - cost, skills }, result: { kind: "buy_skill", skill, level: level + 1, cost } };
};
const getPreviousAction = async (db: D1DatabaseSession, accountUserId: number, actionId: string): Promise<Record<string, unknown> | null> => {
  const previous = await db.prepare("SELECT result_json FROM forge_action_logs WHERE account_user_id = ? AND action_id = ? LIMIT 1").bind(accountUserId, actionId).first<{ result_json: string }>();
  if (!previous) return null;
  const parsed = JSON.parse(previous.result_json);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
};
export const getForgeSession = async (user: AuthUser | null, gameDb?: D1Database, request?: Request): Promise<Response> => {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!gameDb) return Response.json({ error: "Forge service unavailable" }, { status: 503 });
  const effectiveRequest = request ?? new Request("https://forge.invalid/games/forge");
  const db = createForgeDbSession(gameDb, effectiveRequest);
  try {
    return setBookmark(Response.json(responseState(await loadOrCreate(db, user.id)), { headers: { "Cache-Control": "no-store" } }), db, effectiveRequest);
  } catch {
    return setBookmark(Response.json({ error: "Forge service unavailable" }, { status: 503 }), db, effectiveRequest);
  }
};
export const handleForgeAction = async (request: Request, user: AuthUser | null, body: Record<string, unknown> | null, gameDb?: D1Database): Promise<Response> => {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!gameDb) return Response.json({ error: "Forge service unavailable" }, { status: 503 });
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const action = parseAction(body);
  if (!action) return Response.json({ error: "Invalid action" }, { status: 400 });
  const db = createForgeActionDbSession(gameDb);
  try {
    const session = await loadOrCreate(db, user.id);
    if (session.version !== action.version) {
      const current = await loadForgeSession(db, user.id);
      return setBookmark(Response.json({ ...responseState(current ?? session), error: "Session changed" }, { status: 409, headers: { "Cache-Control": "no-store" } }), db, request);
    }
    let nextState = session.state;
    let nextShop = session.shopWeapons;
    let result: Record<string, unknown>;
    if (action.action === "BUY_WEAPON") ({ state: nextState, shop: nextShop, result } = buyWeapon(nextState, nextShop, action.weaponId));
    else if (action.action === "UPGRADE") {
      const upgrade = resolveUpgrade(nextState, randomRoll(), randomRoll());
      nextState = { ...nextState, gold: nextState.gold - upgrade.cost, currentWeapon: upgrade.weapon };
      result = { kind: upgrade.kind, cost: upgrade.cost, weapon: upgrade.weapon, destroyed: upgrade.weapon === null };
    } else if (action.action === "SELL_WEAPON") {
      if (!nextState.currentWeapon) throw new Error("No weapon equipped");
      const price = getSellPrice(nextState.currentWeapon, nextState.skills);
      result = { kind: "sell_weapon", soldWeapon: nextState.currentWeapon, price };
      nextState = { ...nextState, gold: nextState.gold + price, currentWeapon: null };
    } else if (action.action === "REFRESH_SHOP") {
      nextShop = createShop();
      result = { kind: "refresh_shop" };
    } else ({ state: nextState, result } = applySkill(nextState, action.skill));
    const pending = { state: nextState, shopWeapons: nextShop, version: action.version + 1 };
    const payload = responseState(pending, result);
    try {
      const committed = await commitForgeSessionAction(db, user.id, nextState, nextShop, action.version, action.action, action.actionId, JSON.stringify(payload));
      return setBookmark(Response.json(responseState(committed, result), { headers: { "Cache-Control": "no-store" } }), db, request);
    } catch (commitError) {
      const previous = await getPreviousAction(db, user.id, action.actionId);
      if (previous) return setBookmark(Response.json(previous, { headers: { "Cache-Control": "no-store" } }), db, request);
      throw commitError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forge action failed";
    const status = /Session changed|concurrently/i.test(message) ? 409 : /Insufficient|unavailable|not available|No weapon|already maxed|required/i.test(message) ? 400 : 500;
    return setBookmark(Response.json({ error: status === 500 ? "Forge action failed" : message }, { status }), db, request);
  }
};
