import { findBoardSynergy, getRerollLimit, type GameState, type PlayerStats } from "./9grid";

export interface NineGridViewModel {
  round: number;
  turn: number;
  playerHp: number;
  playerMaxHp: number;
  playerStats: PlayerStats;
  monsterHp: number;
  monsterMaxHp: number;
  score: number;
  phase: GameState["round"]["phase"];
  gameOver: boolean;
  selectedCardId: string | null;
  rerollsUsed: number;
  rerollLimit: number;
  activeRaces: Array<{ race: string; level: number }>;
  activeJobs: Array<{ job: string; level: number }>;
  board: GameState["board"];
  candidates: GameState["round"]["candidates"]["cards"];
}

export const present9GridState = (state: GameState, score = 0): NineGridViewModel => {
  const synergy = findBoardSynergy(state.board);
  const activeRaces = Object.entries(synergy.races)
    .filter((entry): entry is [string, number] => entry[1] > 0)
    .map(([race, level]) => ({ race, level }));
  const activeJobs = Object.entries(synergy.jobs)
    .filter((entry): entry is [string, number] => entry[1] > 0)
    .map(([job, level]) => ({ job, level }));

  return {
    round: state.round.round,
    turn: state.round.turn,
    playerHp: state.round.playerHp,
    playerMaxHp: state.round.playerMaxHp,
    playerStats: { ...state.playerStats },
    monsterHp: state.round.monsterHp,
    monsterMaxHp: state.round.monsterMaxHp,
    score,
    phase: state.round.phase,
    gameOver: state.gameOver,
    selectedCardId: state.round.candidates.selectedCardId,
    rerollsUsed: state.round.candidates.rerollsUsed,
    rerollLimit: getRerollLimit(synergy.races.goblin ?? 0),
    activeRaces,
    activeJobs,
    board: state.board.map((card) => card ? { ...card } : null),
    candidates: state.round.candidates.cards.map((card) => ({ ...card })),
  };
};
