import { Router, Response, NextFunction, Request } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth";
import * as exercisesService from "./exercises.service";

const router = Router();

const submitSchema = z.object({
  answer: z.string().min(1, "Resposta não pode ser vazia."),
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await exercisesService.getExercise(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/:id/submit",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { answer } = submitSchema.parse(req.body);
      const result = await exercisesService.submitExercise(req.userId as string, req.params.id, answer);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
