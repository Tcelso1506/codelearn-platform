import { Router, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth";
import * as codeService from "./code.service";

const router = Router();

// Executar código é caro (spawna container). Limite mais apertado que o resto da API.
const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  // Limite por usuário (a rota já exige login), não por IP — evita punir quem divide o mesmo IP.
  keyGenerator: (req) => (req as AuthenticatedRequest).userId ?? "anonymous",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas execuções em pouco tempo. Aguarde um pouco antes de tentar de novo." },
});

const executeSchema = z.object({
  language: z.string().min(1),
  code: z.string().min(1).max(20_000),
  stdin: z.string().max(5_000).optional(),
});

router.post(
  "/execute",
  requireAuth,
  executeLimiter,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { language, code, stdin } = executeSchema.parse(req.body);
      const result = await codeService.requestExecution(req.userId as string, language, code, stdin);
      res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/execute/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await codeService.getExecution(req.userId as string, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
