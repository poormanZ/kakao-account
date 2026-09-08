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
    expect(html).toContain("id=\"monster-attack-top\"");
    expect(html).toContain("id=\"atk-detail\"");
    expect(html).toContain("id=\"def-detail\"");
    expect(html).toContain("id=\"mana-detail\"");
    expect(html).toContain("WARRIOR LV");
    expect(html).toContain("TANK LV");
    expect(html).toContain("MAGE LV");
  });

  it("shows job-specific card placement stat gains", async () => {
    const response = render9GridPage({ id: 7, nickname: "poorman", profile_image_url: null });
    const html = await response.text();

    expect(html).toContain('warrior:[["⚔ ATK",2],["◈ DEF",0]]');
    expect(html).toContain('tank:[["⚔ ATK",0],["◈ DEF",2]]');
    expect(html).toContain('healer:[["♥ HP",6],["◈ DEF",0]]');
    expect(html).toContain('mage:[["◆ MANA",1],["⚔ ATK",0]]');
    expect(html).toContain('firstValue.textContent="+"+values[0][1]');
    expect(html).toContain('secondValue.textContent="+"+values[1][1]');
    expect(html).not.toContain("const jobStats={warrior:[3,1],tank:[1,3],healer:[1,1],mage:[2,1]}");
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

  it("keeps all-card reroll and restart controls", async () => {
    const response = render9GridPage({ id: 7, nickname: "poorman", profile_image_url: null });
    const html = await response.text();

    expect(html).toContain("REROLL ALL");
    expect(html).toContain("GAME RESTART");
    expect(html).toContain("REROLL은 3장의 카드를 한 번에 교체합니다");
    expect(html).not.toContain("REROLL CHECKED");
    expect(html).not.toContain("reroll-check");
    expect(html).not.toContain("rerollSet");
  });

  it("renders the reference-inspired hierarchy and responsive layout", async () => {
    const response = render9GridPage({ id: 7, nickname: "poorman", profile_image_url: null });
    const html = await response.text();

    expect(html).toContain("RUN PROGRESS");
    expect(html).toContain("PLAYER STATUS");
    expect(html).toContain("ENEMY");
    expect(html).toContain("RUN STATE");
    expect(html).toContain("SELECT CARD → PLACE");
    expect(html).toContain("id=\"candidate-phase\"");
    expect(html).toContain("id=\"candidate-help\"");
    expect(html).toContain("grid-template-columns:minmax(0,1.08fr) minmax(380px,.82fr) minmax(215px,.42fr)");
    expect(html).toContain("BOARD <span class=\"accent\">// 3 × 3</span>");
    expect(html).toContain("CANDIDATES <span class=\"accent\">// 3 CARDS</span>");
    expect(html).toContain("RACE // 종족 효과");
    expect(html).toContain("JOB // 직업 효과");
  });
});
