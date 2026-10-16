import { describe, expect, it } from "vitest";
import { answersMatch, normalizeAnswer } from "../src/utils/answer";

describe("normalizeAnswer", () => {
  it("ignora maiúsculas e espaços nas pontas", () => {
    expect(normalizeAnswer("  Grande ")).toBe("grande");
  });

  it("colapsa espaços repetidos", () => {
    expect(normalizeAnswer("1   2\n3")).toBe("1 2 3");
  });
});

describe("answersMatch", () => {
  it("aceita respostas equivalentes", () => {
    expect(answersMatch("TRUE", "True")).toBe(true);
    expect(answersMatch(" 55 ", "55")).toBe(true);
  });

  it("rejeita respostas diferentes", () => {
    expect(answersMatch("54", "55")).toBe(false);
    expect(answersMatch("", "55")).toBe(false);
  });
});
