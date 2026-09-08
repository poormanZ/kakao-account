import type { Job, PlayerStats } from "./9grid";

export const INITIAL_PLAYER_STATS: PlayerStats = {
  attack: 2,
  defense: 2,
  maxHp: 80,
  mana: 1,
};

export const JOB_BASE_STAT_VALUES: Record<Job, number> = {
  warrior: 2,
  tank: 2,
  healer: 6,
  mage: 1,
};

export const MONSTER_MAX_HP_BY_ROUND = [
  90, 160, 250, 380, 560,
  800, 1100, 1500, 2000, 2600,
] as const;

export const MONSTER_ATTACK_BY_ROUND = [
  8, 10, 12, 14, 17,
  20, 24, 28, 32, 36,
] as const;

export const getMonsterMaxHp = (round: number): number => {
  if (!Number.isInteger(round) || round < 1) throw new Error("Invalid round");
  const index = Math.min(round, MONSTER_MAX_HP_BY_ROUND.length) - 1;
  const last = MONSTER_MAX_HP_BY_ROUND[MONSTER_MAX_HP_BY_ROUND.length - 1];
  if (round <= MONSTER_MAX_HP_BY_ROUND.length) return MONSTER_MAX_HP_BY_ROUND[index];
  return Math.ceil(last * Math.pow(1.3, round - MONSTER_MAX_HP_BY_ROUND.length));
};

export const getMonsterAttack = (round: number): number => {
  if (!Number.isInteger(round) || round < 1) throw new Error("Invalid round");
  const index = Math.min(round, MONSTER_ATTACK_BY_ROUND.length) - 1;
  const last = MONSTER_ATTACK_BY_ROUND[MONSTER_ATTACK_BY_ROUND.length - 1];
  if (round <= MONSTER_ATTACK_BY_ROUND.length) return MONSTER_ATTACK_BY_ROUND[index];
  return last + (round - MONSTER_ATTACK_BY_ROUND.length) * 3;
};

export const getJobBaseStatValue = (job: Job): number => JOB_BASE_STAT_VALUES[job];
