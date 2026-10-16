import { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "./auth";

/**
 * Deve rodar depois de `requireAuth`. Não colocamos a role no JWT para evitar
 * que uma promoção/rebaixamento de admin só tenha efeito depois do token
 * expirar — aqui sempre lemos o estado atual do usuário no banco.
 */
export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });

    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ error: "Acesso restrito a administradores." });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}
