import { createInitialForgeState, type ForgeGameState, type ForgeSkills, type ForgeWeapon } from "./forge";

export interface ForgeSessionRecord {
  state: ForgeGameState;
  shopWeapons: ForgeShopWeapon[];
  version: number;
  lastActionId: string | null;
  lastActionResult: Record<string, unknown> | null;
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

const isWeapon = (value: unknown): value is ForgeWeapon => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 100
    && typeof value.name === "string" && value.name.length > 0 && value.name.length <= 100
    && isNonNegativeInteger(value.baseDamage) && value.baseDamage > 0
    && value.rarity === "common"
    && isNonNegativeInteger(value.enhancementLevel);
};

const isShopWeapon = (value: unknown): value is ForgeShopWeapon => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 100
    && typeof value.name === "string" && value.name.length > 0 && value.name.length <= 100
    && isNonNegativeInteger(value.baseDamage) && value.baseDamage > 0
    && value.rarity === "common";
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
  if (!Array.isArray(parsed) || parsed.length !== 3 || !parsed.every(isShopWeapon)) {
    throw new Error("Stored forge shop is invalid");
  }
  return parsed;
};

const parseLastActionResult = (value: string | null): Record<string, unknown> | null => {
  if (!value) return null;
  const parsed = parseJson(value);
  return isRecord(parsed) ? parsed : null;
};

export const loadForgeSession = async (
  db: D1DatabaseSession,
  accountUserId: number,
): Promise<ForgeSessionRecord | null> => {
  const row = await db.prepare(
    "SELECT gold, current_weapon_json, shop_weapons_json, skills_json, version, last_action_id, last_action_result_json FROM forge_game_states WHERE account_user_id = ? LIMIT 1",
  ).bind(accountUserId).first<{
    gold: number;
    current_weapon_json: string;
    shop_weapons_json: string;
    skills_json: string;
    version: number;
    last_action_id: string | null;
    last_action_result_json: string | null;
  }>();

  if (!row) return null;
  if (!isNonNegativeInteger(row.gold) || !Number.isInteger(row.version) || row.version <= 0) {
    throw new Error("Stored forge session metadata is invalid");
  }

  const state = parseState(row.current_weapon_json);
  if (state.gold !== row.gold) throw new Error("Stored forge gold is inconsistent");

  const skills = parseJson(row.skills_json);
  if (!isForgeSkills(skills)) throw new Error("Stored forge skills are invalid");

  if (row.last_action_id !== null && (!row.last_action_id || row.last_action_id.length > 64)) {
    throw new Error("Stored forge action id is invalid");
  }

  const lastActionResult = parseLastActionResult(row.last_action_result_json);
  if (row.last_action_result_json !== null && !lastActionResult) {
    throw new Error("Stored forge action result is invalid");
  }

  return {
    state: { ...state, skills },
    shopWeapons: parseShopWeapons(row.shop_weapons_json),
    version: row.version,
    lastActionId: row.last_action_id,
    lastActionResult,
  };
};

export const createForgeSession = async (
  db: D1DatabaseSession,
  accountUserId: number,
  shopWeapons: ForgeShopWeapon[],
): Promise<ForgeSessionRecord> => {
  if (!Number.isInteger(accountUserId) || accountUserId <= 0) throw new Error("Invalid account user id");
  if (shopWeapons.length !== 3 || !shopWeapons.every(isShopWeapon)) throw new Error("Invalid forge shop");

  const state = createInitialForgeState();
  await db.prepare(
    "INSERT INTO forge_game_states (account_user_id, gold, current_weapon_json, shop_weapons_json, skills_json, version, updated_at, last_action_id, last_action_result_json) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, NULL, NULL)",
  ).bind(
    accountUserId,
    state.gold,
    JSON.stringify(state.currentWeapon),
    JSON.stringify(shopWeapons),
    JSON.stringify(state.skills),
  ).run();

  return {
    state,
    shopWeapons,
    version: 1,
    lastActionId: null,
    lastActionResult: null,
  };
};

export const commitForgeSessionAction = async (
  db: D1DatabaseSession,
  accountUserId: number,
  state: ForgeGameState,
  shopWeapons: ForgeShopWeapon[],
  expectedVersion: number,
  actionId: string,
  resultJson: string,
): Promise<ForgeSessionRecord> => {
  if (!Number.isInteger(accountUserId) || accountUserId <= 0) throw new Error("Invalid account user id");
  if (!isForgeState(state) || shopWeapons.length !== 3 || !shopWeapons.every(isShopWeapon)) {
    throw new Error("Invalid forge session");
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) throw new Error("Invalid forge session version");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(actionId) || !resultJson) throw new Error("Invalid forge action");

  const parsedResult = parseLastActionResult(resultJson);
  if (!parsedResult) throw new Error("Invalid forge action result");

  const nextVersion = expectedVersion + 1;
  const result = await db.prepare(
    "UPDATE forge_game_states SET gold = ?, current_weapon_json = ?, shop_weapons_json = ?, skills_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP, last_action_id = ?, last_action_result_json = ? WHERE account_user_id = ? AND version = ?",
  ).bind(
    state.gold,
    JSON.stringify(state.currentWeapon),
    JSON.stringify(shopWeapons),
    JSON.stringify(state.skills),
    nextVersion,
    actionId,
    resultJson,
    accountUserId,
    expectedVersion,
  ).run();

  if (result.meta.changes !== 1) throw new ForgeSessionConflictError();

  return {
    state,
    shopWeapons,
    version: nextVersion,
    lastActionId: actionId,
    lastActionResult: parsedResult,
  };
};
