import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import pino from "pino";

// Banco, fila e logger simulados: estes testes exercitam a API HTTP de verdade
// (Express, Zod, middlewares, serviços), sem precisar de Postgres/Redis/engine do Prisma.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/queue", () => ({
  redisConnection: { ping: vi.fn().mockResolvedValue("PONG") },
  codeExecutionQueue: { add: vi.fn() },
}));
vi.mock("../src/lib/logger", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/logger")>();
  return { ...original, logger: pino({ level: "silent" }) };
});

import { signAccessToken } from "../src/utils/jwt";
import { hashPassword } from "../src/utils/password";
import { redactConfig } from "../src/lib/logger";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { createApp } = await import("../src/app");
  server = createApp().listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function call(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
}

const validToken = () => signAccessToken({ sub: "user-1", email: "a@b.com" });

describe("saúde e infraestrutura", () => {
  it("GET /health responde 200 e devolve um x-request-id", async () => {
    const res = await call("/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("reaproveita o x-request-id enviado pelo cliente", async () => {
    const res = await fetch(`${baseUrl}/health`, { headers: { "x-request-id": "abc-123" } });
    expect(res.headers.get("x-request-id")).toBe("abc-123");
  });

  it("GET /health/ready devolve 503 quando o banco não responde", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error("db down"));
    const res = await call("/health/ready");
    expect(res.status).toBe(503);
    expect(res.json.checks.database).toBe("fail");
    expect(res.json.checks.redis).toBe("ok");
  });

  it("rota inexistente devolve 404 em JSON", async () => {
    const res = await call("/nao-existe");
    expect(res.status).toBe(404);
    expect(res.json.error).toBeTruthy();
  });
});

describe("cadastro e login", () => {
  it("rejeita payload inválido com 400 e detalhes por campo", async () => {
    const res = await call("/auth/register", {
      method: "POST",
      body: { email: "nao-e-email", password: "123", name: "A" },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.json.details)).toEqual(expect.arrayContaining(["email", "password", "name"]));
  });

  it("rejeita senha maior que 72 caracteres (limite do bcrypt)", async () => {
    const res = await call("/auth/register", {
      method: "POST",
      body: { email: "a@b.com", password: "x".repeat(80), name: "Ab" },
    });
    expect(res.status).toBe(400);
    expect(res.json.details.password).toBeTruthy();
  });

  it("normaliza o e-mail (trim + minúsculas) e nunca devolve o hash da senha", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockImplementationOnce(async ({ data }: { data: { email: string; name: string } }) => ({
      id: "u1",
      email: data.email,
      name: data.name,
      passwordHash: "hash-secreto",
    }));
    prismaMock.refreshToken.create.mockResolvedValueOnce({});

    const res = await call("/auth/register", {
      method: "POST",
      body: { email: "  Foo@Bar.COM ", password: "senha-forte-123", name: "Foo" },
    });

    expect(res.status).toBe(201);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: "foo@bar.com" } });
    expect(res.json.user.email).toBe("foo@bar.com");
    expect(res.json.accessToken).toBeTruthy();
    expect(res.json.refreshToken).toBeTruthy();
    expect(JSON.stringify(res.json)).not.toContain("hash-secreto");
  });

  it("guarda apenas o hash do refresh token no banco", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce({ id: "u1", email: "a@b.com", name: "Ab" });
    prismaMock.refreshToken.create.mockResolvedValueOnce({});

    const res = await call("/auth/register", {
      method: "POST",
      body: { email: "a@b.com", password: "senha-forte-123", name: "Ab" },
    });

    const stored = prismaMock.refreshToken.create.mock.calls[0][0].data.tokenHash as string;
    expect(stored).not.toBe(res.json.refreshToken);
    expect(stored).toHaveLength(64); // SHA-256 em hex
  });

  it("e-mail já cadastrado devolve 409", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "u1" });
    const res = await call("/auth/register", {
      method: "POST",
      body: { email: "a@b.com", password: "senha-forte-123", name: "Ab" },
    });
    expect(res.status).toBe(409);
  });

  it("login com senha errada e com usuário inexistente devolvem a mesma resposta (sem enumerar usuários)", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "a@b.com",
      name: "Ab",
      passwordHash: await hashPassword("senha-correta-1"),
    });
    const wrongPassword = await call("/auth/login", { method: "POST", body: { email: "a@b.com", password: "errada" } });

    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const unknownUser = await call("/auth/login", { method: "POST", body: { email: "x@y.com", password: "qualquer" } });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.json).toEqual(unknownUser.json);
  });
});

describe("rotação e reuso de refresh token", () => {
  const stored = (revokedMsAgo: number | null) => ({
    id: "rt1",
    userId: "u1",
    revokedAt: revokedMsAgo === null ? null : new Date(Date.now() - revokedMsAgo),
    expiresAt: new Date(Date.now() + 60_000),
    user: { id: "u1", email: "a@b.com", name: "Ab" },
  });

  it("token válido é rotacionado: o antigo é revogado e um novo par é emitido", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValueOnce(stored(null));
    prismaMock.refreshToken.update.mockResolvedValueOnce({});
    prismaMock.refreshToken.create.mockResolvedValueOnce({});

    const res = await call("/auth/refresh", { method: "POST", body: { refreshToken: "qualquer" } });

    expect(res.status).toBe(200);
    expect(prismaMock.refreshToken.update).toHaveBeenCalled();
    expect(res.json.refreshToken).toBeTruthy();
  });

  it("reuso de token revogado há muito tempo encerra TODAS as sessões do usuário", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValueOnce(stored(60_000));
    const res = await call("/auth/refresh", { method: "POST", body: { refreshToken: "roubado" } });

    expect(res.status).toBe(401);
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", revokedAt: null } })
    );
  });

  it("reuso dentro da janela de tolerância (requisições concorrentes) só rejeita, sem derrubar as sessões", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValueOnce(stored(2_000));
    const res = await call("/auth/refresh", { method: "POST", body: { refreshToken: "concorrente" } });

    expect(res.status).toBe(401);
    expect(prismaMock.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe("autenticação e autorização", () => {
  it("rotas protegidas exigem token", async () => {
    for (const path of ["/users/me", "/progress", "/skills", "/gamification/summary", "/projects/progress"]) {
      expect((await call(path)).status).toBe(401);
    }
  });

  it("token adulterado é rejeitado", async () => {
    const res = await call("/users/me", { token: validToken().slice(0, -3) + "abc" });
    expect(res.status).toBe(401);
  });

  it("GET /users/me devolve o perfil com role e sem passwordHash", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "user-1", email: "a@b.com", name: "Ab", role: "STUDENT" });
    const res = await call("/users/me", { token: validToken() });

    expect(res.status).toBe(200);
    expect(res.json.role).toBe("STUDENT");
    const args = prismaMock.user.findUnique.mock.calls[0][0];
    expect(args.select.passwordHash).toBeUndefined();
  });

  it("admin: sem token 401, estudante 403, admin passa pela guarda", async () => {
    expect((await call("/admin/languages", { method: "POST", body: {} })).status).toBe(401);

    prismaMock.user.findUnique.mockResolvedValueOnce({ role: "STUDENT" });
    expect((await call("/admin/languages", { method: "POST", body: {}, token: validToken() })).status).toBe(403);

    // Admin passa pela guarda e só então falha na validação do corpo (400, não 403).
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: "ADMIN" });
    expect((await call("/admin/languages", { method: "POST", body: {}, token: validToken() })).status).toBe(400);
  });

  it("falha de banco na guarda de admin vira 500 tratado, não derruba o processo", async () => {
    prismaMock.user.findUnique.mockRejectedValueOnce(new Error("db down"));
    const res = await call("/admin/languages", { method: "POST", body: {}, token: validToken() });
    expect(res.status).toBe(500);
  });
});

describe("execução de código: validações antes de tocar no banco ou na fila", () => {
  it("exige autenticação", async () => {
    expect((await call("/code/execute", { method: "POST", body: { language: "PYTHON", code: "print(1)" } })).status).toBe(401);
  });

  it("recusa linguagem não suportada", async () => {
    const res = await call("/code/execute", { method: "POST", body: { language: "COBOL", code: "x" }, token: validToken() });
    expect(res.status).toBe(400);
  });

  it("recusa código acima do limite e caractere nulo", async () => {
    const tooLong = await call("/code/execute", {
      method: "POST",
      body: { language: "PYTHON", code: "x".repeat(20_001) },
      token: validToken(),
    });
    expect(tooLong.status).toBe(400);

    const withNul = await call("/code/execute", {
      method: "POST",
      body: { language: "PYTHON", code: "print(1)\u0000" },
      token: validToken(),
    });
    expect(withNul.status).toBe(400);
  });
});

describe("projetos", () => {
  it("só aceita links de repositório do GitHub em https", async () => {
    for (const repoUrl of ["javascript:alert(1)", "http://github.com/a/b", "https://evil.com/a/b"]) {
      const res = await call("/projects/p1/complete", { method: "POST", body: { repoUrl }, token: validToken() });
      expect(res.status).toBe(400);
    }
  });
});

describe("logs", () => {
  it("a configuração de redaction remove credenciais dos logs de requisição", () => {
    const lines: string[] = [];
    const logger = pino({ redact: redactConfig }, { write: (line: string) => void lines.push(line) });

    logger.info({
      req: { url: "/progress", headers: { authorization: "Bearer TOKEN-SECRETO", cookie: "sid=COOKIE-SECRETO", accept: "*/*" } },
    });

    const output = lines.join("");
    expect(output).not.toContain("TOKEN-SECRETO");
    expect(output).not.toContain("COOKIE-SECRETO");
    expect(output).toContain("/progress");
  });
});
