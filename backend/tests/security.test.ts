import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/utils/password";
import { generateRefreshToken, hashRefreshToken, signAccessToken, verifyAccessToken } from "../src/utils/jwt";

describe("senha", () => {
  it("gera hash diferente do texto original e verifica corretamente", async () => {
    const hash = await hashPassword("minha-senha-forte");
    expect(hash).not.toBe("minha-senha-forte");
    expect(await verifyPassword("minha-senha-forte", hash)).toBe(true);
    expect(await verifyPassword("senha-errada", hash)).toBe(false);
  });
});

describe("tokens", () => {
  it("assina e valida um access token", () => {
    const token = signAccessToken({ sub: "user-1", email: "a@b.com" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("a@b.com");
  });

  it("rejeita um access token adulterado", () => {
    const token = signAccessToken({ sub: "user-1", email: "a@b.com" });
    expect(() => verifyAccessToken(token.slice(0, -2) + "xx")).toThrow();
  });

  it("refresh tokens são únicos e só o hash é determinístico", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(hashRefreshToken(a)).toBe(hashRefreshToken(a));
    expect(hashRefreshToken(a)).not.toBe(a);
  });
});
