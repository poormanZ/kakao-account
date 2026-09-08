import { createInitialForgeState, type ForgeGameState, type ForgeSkills, type ForgeWeapon } from "./forge";

export interface ForgeSessionEnv { GAME_DB: D1Database; }
export interface ForgeSessionRecord { state: ForgeGameState; shopWeapons: ForgeShopWeapon[]; version: number; }
export interface ForgeShopWeapon { id: string; name: string; baseDamage: number; rarity: "common"; }
export class ForgeSessionConflictError extends Error {
  constructor() { super("Forge session was modified concurrently"); this.name = "ForgeSessionConflictError"; }
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isNonNegativeInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isWeapon = (value: unknown): value is ForgeWeapon => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 100
    && typeof value.name === "string" && value.name.length > 0 && value.name.length <= 100
    && isNonNegativeInteger(value.baseDamage) && value.baseDamage > 0 && value.rarity === "common"
    && isNonNegativeInteger(value.enhancementLevel);
};
const isShopWeapon = (value: unknown): value is ForgeShopWeapon => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 100
    && typeof value.name === "string" && value.name.length > 0 && value.name.length <= 100
    && isNonNegativeInteger(value.baseDamage) && value.baseDamage > 0 && value.rarity === "common";
};
const isForgeSkills = (value: unknown): value is ForgeSkills => {
  if (!isRecord(value)) return false;
  return isNonNegativeInteger(value.enhancementBonusLevel)
    && isNonNegativeInteger(value.greatSuccessLevel)
    && isNonNegativeInteger(value.sellBonusLevel);
};
const isForgeState = (value: unknown): value is ForgeGameState => {
  if (!isRecord(value) || !isNonNegativeInteger(value.gold)) return false;
  const weapon = value.currentWeapon;
  if (weapon !== null && !isWeapon(weapon)) return false;
  return isForgeSkills(value.skills);
};
const parseJson = (value: string): unknown => { try { return JSON.parse(value); } catch { return null; } };
const parseState = (value: string): ForgeGameState => {
  const parsed = parseJson(value);
  if (!isForgeState(parsed)) throw new Error("Stored forge state is invalid");
  return parsed;
};
const parseShopWeapons = (value: string): ForgeShopWeapon[] => {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed) || parsed.length !== 3 || !parsed.every(isShopWeapon)) throw new Error("Stored forge shop is invalid");
  return parsed;
};
export const loadForgeSession = async (env: ForgeSessionEnv, accountUserId: number): Promise<ForgeSessionRecord | null> => {
  const row = await env.GAME_DB.prepare("SELECT gold, current_weapon_json, shop_weapons_json, skills_json, version FROM forge_game_states WHERE account_user_id = ? LIMIT 1")
    .bind(accountUserId).first<{ gold: number; current_weapon_json: string; shop_weapons_json: string; skills_json: string; version: number }>();
  if (!row) return null;
  if (!isNonNegativeInteger(row.gold) || !Number.isInteger(row.version) || row.version <= 0) throw new Error("Stored forge session metadata is invalid");
  const state = parseState(row.current_weapon_json);
  if (state.gold !== row.gold) throw new Error("Stored forge gold is inconsistent");
  const skills = parseJson(row.skills_json);
  if (!isForgeSkills(skills)) throw new Error("Stored forge skills are invalid");
  return { state: { ...state, skills }, shopWeapons: parseShopWeapons(row.shop_weapons_json), version: row.version };
};
export const createForgeSession = async (env: ForgeSessionEnv, accountUserId: number, shopWeapons: ForgeShopWeapon[]): Promise<ForgeSessionRecord> => {
  if (!Number.isInteger(accountUserId) || accountUserId <= 0) throw new Error("Invalid account user id");
  if (shopWeapons.length !== 3 || !shopWeapons.every(isShopWeapon)) throw new Error("Invalid forge shop");
  const state = createInitialForgeState();
  await env.GAME_DB.prepare("INSERT INTO forge_game_states (account_user_id, gold, current_weapon_json, shop_weapons_json, skills_json, version, updated_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)")
    .bind(accountUserId, state.gold, JSON.stringify(state.currentWeapon), JSON.stringify(shopWeapons), JSON.stringify(state.skills)).run();
  return { state, shopWeapons, version: 1 };
};
export const updateForgeSession = async (env: ForgeSessionEnv, accountUserId: number, state: ForgeGameState, shopWeapons: ForgeShopWeapon[], expectedVersion: number): Promise<ForgeSessionRecord> => {
  if (!Number.isInteger(accountUserId) || accountUserId <= 0) throw new Error("Invalid account user id");
  if (!isForgeState(state) || shopWeapons.length !== 3 || !shopWeapons.every(isShopWeapon)) throw new Error("Invalid forge session");
  if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) throw new Error("Invalid forge session version");
  const nextVersion = expectedVersion + 1;
  const result = await env.GAME_DB.prepare("UPDATE forge_game_states SET gold = ?, current_weapon_json = ?, shop_weapons_json = ?, skills_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE account_user_id = ? AND version = ?")
    .bind(state.gold, JSON.stringify(state.currentWeapon), JSON.stringify(shopWeapons), JSON.stringify(state.skills), nextVersion, accountUserId, expectedVersion).run();
  if (result.meta.changes !== 1) throw new ForgeSessionConflictError();
  return { state, shopWeapons, version: nextVersion };
};
export const commitForgeSessionAction = async (env: ForgeSessionEnv, accountUserId: number, state: ForgeGameState, shopWeapons: ForgeShopWeapon[], expectedVersion: number, action: string, actionId: string, resultJson: string): Promise<ForgeSessionRecord> => {
  if (!Number.isInteger(accountUserId) || accountUserId <= 0) throw new Error("Invalid account user id");
  if (!isForgeState(state) || shopWeapons.length !== 3 || !shopWeapons.every(isShopWeapon)) throw new Error("Invalid forge session");
  if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) throw new Error("Invalid forge session version");
  if (!action || !actionId || !resultJson) throw new Error("Invalid forge action log");
  const nextVersion = expectedVersion + 1;
  const updateStatement = env.GAME_DB.prepare("UPDATE forge_game_states SET gold = ?, current_weapon_json = ?, shop_weapons_json = ?, skills_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE account_user_id = ? AND version = ?")
    .bind(state.gold, JSON.stringify(state.currentWeapon), JSON.stringify(shopWeapons), JSON.stringify(state.skills), nextVersion, accountUserId, expectedVersion);
  const logStatement = env.GAME_DB.prepare("INSERT INTO forge_action_logs (account_user_id, action, action_id, result_json) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM forge_game_states WHERE account_user_id = ? AND version = ?)")
    .bind(accountUserId, action, actionId, resultJson, accountUserId, nextVersion);
  const results = await env.GAME_DB.batch([updateStatement, logStatement]);
  if (results[0].meta.changes !== 1) throw new ForgeSessionConflictError();
  if (results[1].meta.changes !== 1) throw new Error("Forge action log failed");
  return { state, shopWeapons, version: nextVersion };
};
