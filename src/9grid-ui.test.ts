import { Script } from "node:vm";
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

    expect(() => new Script(script)).not.toThrow();
    expect(html).toContain("/api/games/9grid/session");
    expect(html).toContain("/api/games/9grid/session/action");
  });
});
