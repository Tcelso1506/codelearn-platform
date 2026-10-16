import { Router, Response, NextFunction } from "express";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth";
import { getGamificationSummary } from "./gamification.service";

const router = Router();

router.get("/summary", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await getGamificationSummary(req.userId as string));
  } catch (err) {
    next(err);
  }
});

export default router;
