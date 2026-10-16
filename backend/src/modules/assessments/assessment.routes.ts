import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth";
import * as assessmentService from "./assessment.service";

const router = Router();

const startSchema = z.object({
  languageId: z.string().min(1, "languageId é obrigatório."),
});

const answerSchema = z.object({
  questionId: z.string().min(1, "questionId é obrigatório."),
  answer: z.string().min(1, "answer é obrigatório."),
});

router.post("/start", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { languageId } = startSchema.parse(req.body);
    const result = await assessmentService.startAssessment(req.userId as string, languageId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await assessmentService.getAssessmentStatus(req.userId as string, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/answer", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { questionId, answer } = answerSchema.parse(req.body);
    const result = await assessmentService.answerAssessment(req.userId as string, req.params.id, questionId, answer);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/finish", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await assessmentService.finishAssessment(req.userId as string, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
