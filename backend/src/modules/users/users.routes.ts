import { Router, Response, NextFunction } from "express";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth";
import { getMe } from "../auth/auth.service";

const router = Router();

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await getMe(req.userId as string);
    return res.status(200).json(user);
  } catch (err) {
    return next(err);
  }
});

export default router;
