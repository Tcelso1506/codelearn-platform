import { Router, Response, NextFunction } from "express";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth";
import { getUserProgress } from "./progress.service";

const router = Router();

router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await getUserProgress(req.userId as string));
  } catch (err) {
    next(err);
  }
});

export default router;
