import { Router, Response, NextFunction, Request } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth";
import * as projectsService from "./projects.service";

const router = Router();

const completeSchema = z.object({
  // Só aceitamos links do GitHub (https): evita esquemas perigosos como javascript:
  // caso esse link venha a ser exibido como âncora no futuro.
  repoUrl: z
    .string()
    .url("URL de repositório inválida.")
    .refine((url) => /^https:\/\/(www\.)?github\.com\/[^\s]+$/i.test(url), "Use um link https://github.com/...")
    .optional(),
});

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await projectsService.listProjects());
  } catch (err) {
    next(err);
  }
});

router.get("/progress", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await projectsService.getUserProjectProgress(req.userId as string));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await projectsService.getProject(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/start", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await projectsService.startProject(req.userId as string, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/complete", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { repoUrl } = completeSchema.parse(req.body);
    res.json(await projectsService.completeProject(req.userId as string, req.params.id, repoUrl));
  } catch (err) {
    next(err);
  }
});

export default router;
