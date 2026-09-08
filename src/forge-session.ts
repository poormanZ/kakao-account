import { createInitialForgeState, type ForgeGameState } from "./forge";

export interface ForgeSessionEnv {
  GAME_DB: D1Database;
}

export interface ForgeSessionRecord {
  state: ForgeGameState;
  shopWeapons: ForgeShopWeapon[];
  version: number;
}

export interface ForgeShopWeapon {
  id: string;
  name: string;
  baseDamage: number;
  rarity: "common";
}

export class ForgeSessionConflictError extends Error {
  constructor() {
    super("Forge session was modified concurrently");
    this.name = "ForgeSessionConflictError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isWeapon = (value: unknown): value is ForgeShopWeapon => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && value.id.length > 0
    && value.id.length <= 100
    && typeof value.name === "string"
    && value.name.length > 0
    && value.name.length <= 100
    && isNonNegativeInteger(value.baseDamage)
    && value.baseDamage > 0
    && value.rarity === "common";
};

const isForgeState = (value: unknown): value is ForgeGameState => {
  if (!isRecord(value) || !isNonNegativeInteger(value.gold)) return false;
  const weapon = value.currentWeapon;
  const skills = value.skills;
  if (!isWeapon(weapon)) return false;
  if (!isRecord(skills)) return false;
  return isNonNegativeInteger(skills.enhancementBonusLevel)
    && isNonNegativeInteger(skills.greatSuccessLevel)
    && isNonNegativeInteger(skills.sellBonusLevel)
    && isNonNegativeInteger(weapon.enhancementLevel);
};

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const parseState = (value: string): ForgeGameState => {
  const parsed = parseJson(value);
  if (!isForgeState(parsed)) throw new Error("Stored forge state is invalid");
  return parsed;
};

const parseShopWeapons = (value: string): ForgeShopWeapon[] => {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed) || parsed.length !== 3 || !parsed.every(isWeapon)) {
    throw new Error("Stored forge shop is invalid");
  }
  return parsed;
};

export const loadForgeSession = async (
  env: ForgeSessionEnv,
  accountUserId: number,
): Promise<ForgeSessionRecord | null> => {
  const row = await env.GAME_DB.prepare(
    "SELECT gold, current_weapon_json, shop_weapons_json, skills_json, version FROM forge_game_states WHERE account_user_id = ? LIMIT 1",
  ).bind(accountUserId).first<{
    gold: number;
    current_weapon_json: string;
    shop_weapons_json: string;
    skills_json: string;
    version: number;
  }>();
  if (!row) return null;
  if (!isNonNegativeInteger(row.gold) || !Number.isInteger(row.version) || row.version <= 0) {
    throw new Error("Stored forge session metadata is invalid");
  }
  const state = parseState(row.current_weapon_json);
  if (state.gold !== row.gold) throw new Error("Stored forge gold is inconsistent");
  const storedSkills = parseJson(row.skills_json);
  if (!isRecord(storedSkills)) throw new Error("Stored forge skills are invalid");
  const skillsState = { ...state, skills: storedSkills };
  if (!isForgeState(skillsState)) throw new Error("Stored forge skills are invalid");
  return {
    state: skillsState,
    shopWeapons: parseShopWeapons(row.shop_weapons_json),
    version: row.version,
  };
};

export const createForgeSession = async (
  env: ForgeSessionEnv,
  accountUserId: number,
  shopWeapons: ForgeShopWeapon[],
): Promise<ForgeSessionRecord> => {
  if (!Number.isInteger(accountUserId) || accountUserId <= 0) throw new Error("Invalid account user id");
  if (shopWeapons.length !== 3 || !shopWeapons.every(isWeapon)) throw new Error("Invalid forge shop");
  const state = createInitialForgeState();
  await env.GAME_DB.prepare(
    "INSERT INTO forge_game_states (account_user_id, gold, current_weapon_json, shop_weapons_json, skills_json, version, updated_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)",
  ).bind(
    accountUserId,
    state.gold,
    JSON.stringify(state.currentWeapon),
    JSON.stringify(shopWeapons),
    JSON.stringify(state.skills),
  ).run();
  return { state, shopWeapons, version: 1 };
};

export const updateForgeSession = async (
  env: ForgeSessionEnv,
  accountUserId: number,
  state: ForgeGameState,
  shopWeapons: ForgeShopWeapon[],
  expectedVersion: number,
): Promise<ForgeSessionRecord> => {
  if (!Number.isInteger(accountUserId) || accountUserId <= 0) throw new Error("Invalid account user id");
  if (!isForgeState(state) || shopWeapons.length !== 3 || !shopWeapons.every(isWeapon)) {
    throw new Error("Invalid forge session");
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) throw new Error("Invalid forge session version");
  const nextVersion = expectedVersion + 1;
  const result = await env.GAME_DB.prepare(
    "UPDATE forge_game_states SET gold = ?, current_weapon_json = ?, shop_weapons_json = ?, skills_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE account_user_id = ? AND version = ?",
  ).bind(
    state.gold,
    JSON.stringify(state.currentWeapon),
    JSON.stringify(shopWeapons),
    JSON.stringify(state.skills),
    nextVersion,
    accountUserId,
    expectedVersion,
  ).run();
  if (result.meta.changes !== 1) throw new ForgeSessionConflictError();
  return { state, shopWeapons, version: nextVersion };
};
