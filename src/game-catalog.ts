export type GameStatus = "active" | "coming_soon";

export interface GameCatalogItem {
  slug: string;
  name: string;
  description: string;
  icon: string;
  status: GameStatus;
  sort_order: number;
  ranking_enabled: boolean;
}

export const GAME_CATALOG: GameCatalogItem[] = [
  {
    slug: "click-rush",
    name: "Click Rush",
    description: "제한 시간 안에 움직이는 타겟을 최대한 많이 클릭하세요.",
    icon: "✦",
    status: "active",
    sort_order: 10,
    ranking_enabled: true,
  },
  {
    slug: "reaction",
    name: "Reaction Test",
    description: "화면의 신호에 얼마나 빠르게 반응하는지 겨뤄보세요.",
    icon: "⚡",
    status: "active",
    sort_order: 20,
    ranking_enabled: true,
  },
  {
    slug: "memory",
    name: "Memory Grid",
    description: "순간적으로 표시되는 패턴을 기억하고 입력하세요.",
    icon: "▦",
    status: "coming_soon",
    sort_order: 30,
    ranking_enabled: true,
  },
  {
    slug: "code-runner",
    name: "Code Runner",
    description: "제한 시간 안에 올바른 코드를 실행해 최고 점수에 도전하세요.",
    icon: ">_",
    status: "coming_soon",
    sort_order: 40,
    ranking_enabled: true,
  },
];
