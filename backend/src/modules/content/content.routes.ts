import { Router, Request, Response, NextFunction } from "express";
import * as contentService from "./content.service";

const router = Router();

router.get("/languages", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await contentService.listLanguages());
  } catch (err) {
    next(err);
  }
});

router.get("/languages/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await contentService.getLanguage(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get("/courses", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await contentService.listCourses());
  } catch (err) {
    next(err);
  }
});

router.get("/courses/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await contentService.getCourse(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get("/modules/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await contentService.getModule(req.params.id));
  } catch (err) {
    next(err);
  }
});

export default router;
