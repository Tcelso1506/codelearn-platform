import { Router, Response, NextFunction } from "express";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth";
import { getUserSkills } from "./skills.service";

const router = Router();

router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await getUserSkills(req.userId as string));
  } catch (err) {
    next(err);
  }
});

export default router;
