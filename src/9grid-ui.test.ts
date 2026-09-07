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

  it("renders monster attack and job synergy multiplier fields", async () => {
    const response = render9GridPage({ id: 7, nickname: "poorman", profile_image_url: null });
    const html = await response.text();

    expect(html).toContain("MONSTER ATTACK");
    expect(html).toContain("id=\"monster-attack\"");
    expect(html).toContain("id=\"atk-detail\"");
    expect(html).toContain("id=\"def-detail\"");
    expect(html).toContain("id=\"mana-detail\"");
    expect(html).toContain("id=\"hp-detail\"");
    expect(html).toContain("WARRIOR LV");
    expect(html).toContain("TANK LV");
    expect(html).toContain("MAGE LV");
    expect(html).toContain("HEALER LV");
  });
});
