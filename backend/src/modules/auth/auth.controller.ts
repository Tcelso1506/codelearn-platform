import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "./auth.service";

// E-mail normalizado (trim + minúsculas) para não permitir contas duplicadas
// por diferença de caixa. bcrypt ignora tudo além de 72 bytes, então limitamos.
const emailSchema = z
  .string()
  .trim()
  .email("E-mail inválido.")
  .transform((value) => value.toLowerCase());

const registerSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .max(72, "A senha deve ter no máximo 72 caracteres."),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres."),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Senha é obrigatória."),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken é obrigatório."),
});

export async function registerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    const result = await authService.register(email, password, name);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await authService.logout(refreshToken);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}
