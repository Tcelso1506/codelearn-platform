import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Payload inválido.",
      details: err.flatten().fieldErrors,
    });
  }

  if (err instanceof HttpError) {
    // Erros esperados (4xx de negócio) — nível warn, não polui alerta de erro real.
    logger.warn({ err, path: req.path }, err.message);
    return res.status(err.status).json({ error: err.message });
  }

  logger.error({ err, path: req.path }, "Erro não tratado");

  const isProd = process.env.NODE_ENV === "production";
  return res.status(500).json({
    error: "Erro interno do servidor.",
    ...(isProd ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
}
