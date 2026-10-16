import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../utils/password";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiryDate,
  verifyAccessToken,
} from "../../utils/jwt";
import { HttpError } from "../../middleware/errorHandler";

const REUSE_GRACE_MS = 10_000;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function issueTokenPair(userId: string, email: string): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: userId, email });
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiryDate(),
    },
  });

  return { accessToken, refreshToken };
}

export async function register(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "Já existe uma conta com este e-mail.");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });

  const tokens = await issueTokenPair(user.id, user.email);

  return {
    user: { id: user.id, email: user.email, name: user.name },
    ...tokens,
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(401, "E-mail ou senha inválidos.");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "E-mail ou senha inválidos.");
  }

  const tokens = await issueTokenPair(user.id, user.email);

  return {
    user: { id: user.id, email: user.email, name: user.name },
    ...tokens,
  };
}

export async function refresh(refreshTokenValue: string) {
  const tokenHash = hashRefreshToken(refreshTokenValue);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) {
    throw new HttpError(401, "Refresh token inválido ou expirado.");
  }

  if (stored.revokedAt) {
    // Reuso de um token já rotacionado: pode ser roubo. Passada a janela de
    // tolerância (abas/requisições concorrentes legítimas), encerramos todas as sessões.
    if (Date.now() - stored.revokedAt.getTime() > REUSE_GRACE_MS) {
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    throw new HttpError(401, "Refresh token inválido ou expirado.");
  }

  if (stored.expiresAt < new Date()) {
    throw new HttpError(401, "Refresh token inválido ou expirado.");
  }

  // Rotaciona o refresh token: revoga o antigo e emite um novo.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokenPair(stored.user.id, stored.user.email);

  return {
    user: { id: stored.user.id, email: stored.user.email, name: stored.user.name },
    ...tokens,
  };
}

export async function logout(refreshTokenValue: string) {
  const tokenHash = hashRefreshToken(refreshTokenValue);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true, role: true },
  });

  if (!user) {
    throw new HttpError(404, "Usuário não encontrado.");
  }

  return user;
}

// Reexport para uso em rotas que só precisam validar o access token.
export { verifyAccessToken };
