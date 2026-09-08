import { describe, expect, it } from "vitest";
import { render9GridPage } from "./9grid-ui";

const extractScript = (html: string): string => {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("9Grid UI script was not rendered");
  return match[1];
};

describe("9Grid UI", () => {
  it("renders an executable client script", async () => {
    const response = render9GridPage({ id: 7, nickname: "poorman", profile_image_url: null });
    const html = await response.text();
    const script = extractScript(html);

    expect(() => new Function(script)).not.toThrow();
    expect(html).toContain("/api/games/9grid/session");
    expect(html).toContain("/api/games/9grid/session/action");
  });

  it("renders monster attack and combat stat synergy fields", async () => {
    const response = render9GridPage({ id: 7, nickname: "poorman", profile_image_url: null });
    const html = await response.text();

    expect(html).toContain("MONSTER ATTACK");
    expect(html).toContain("id=\"monster-attack\"");
    expect(html).toContain("id=\"atk-detail\"");
    expect(html).toContain("id=\"def-detail\"");
    expect(html).toContain("id=\"mana-detail\"");
    expect(html).toContain("WARRIOR LV");
    expect(html).toContain("TANK LV");
    expect(html).toContain("MAGE LV");
  });

  it("renders concise race, job, and synergy effect descriptions", async () => {
    const response = render9GridPage({ id: 7, nickname: "poorman", profile_image_url: null });
    const html = await response.text();

    expect(html).toContain("RACE // 종족");
    expect(html).toContain("GOBLIN");
    expect(html).toContain("시너지 LV마다 리롤 +1회");
    expect(html).toContain("ELF");
    expect(html).toContain("시너지 LV마다 공격 횟수 +1");
    expect(html).toContain("DWARF");
    expect(html).toContain("시너지 LV마다 카드 배치 능력치 +1");
    expect(html).toContain("DRAGON");
    expect(html).toContain("시너지 LV마다 라운드 점수 +1배");
    expect(html).toContain("JOB // 직업");
    expect(html).toContain("WARRIOR");
    expect(html).toContain("TANK");
    expect(html).toContain("HEALER");
    expect(html).toContain("MAGE");
  });

  it("removes per-card reroll selection and exposes all-card reroll plus restart", async () => {
    const response = render9GridPage({ id: 7, nickname: "poorman", profile_image_url: null });
    const html = await response.text();

    expect(html).toContain("REROLL ALL");
    expect(html).toContain("GAME RESTART");
    expect(html).toContain("REROLL은 3장의 카드를 한 번에 교체합니다");
    expect(html).not.toContain("REROLL CHECKED");
    expect(html).not.toContain("reroll-check");
    expect(html).not.toContain("rerollSet");
  });

  it("renders a clearer grouped status layout and candidate phase guidance", async () => {
    const response = render9GridPage({ id: 7, nickname: "poorman", profile_image_url: null });
    const html = await response.text();

    expect(html).toContain("RUN PROGRESS");
    expect(html).toContain("PLAYER STATUS");
    expect(html).toContain("ENEMY");
    expect(html).toContain("RUN STATE");
    expect(html).toContain("SELECT CARD → PLACE ON BOARD");
    expect(html).toContain("id=\"candidate-phase\"");
    expect(html).toContain("id=\"candidate-help\"");
    expect(html).toContain("align-items:start");
    expect(html).toContain("font-size:23px");
    expect(html).toContain("font-size:17px");
  });
});
