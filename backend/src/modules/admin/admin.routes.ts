import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/admin";
import * as adminService from "./admin.service";

const router = Router();

router.use(requireAuth, requireAdmin);

// ── Languages ───────────────────────────────────────────────────────
const languageCreateSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
});
const languageUpdateSchema = languageCreateSchema.omit({ slug: true }).partial();

router.post("/languages", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await adminService.createLanguage(languageCreateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

router.put("/languages/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await adminService.updateLanguage(req.params.id, languageUpdateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

router.delete("/languages/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await adminService.deleteLanguage(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Courses ─────────────────────────────────────────────────────────
const courseCreateSchema = z.object({
  languageId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int().optional(),
});
const courseUpdateSchema = courseCreateSchema.omit({ languageId: true, slug: true }).partial();

router.post("/courses", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await adminService.createCourse(courseCreateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

router.put("/courses/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await adminService.updateCourse(req.params.id, courseUpdateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

router.delete("/courses/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await adminService.deleteCourse(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Modules ─────────────────────────────────────────────────────────
const moduleCreateSchema = z.object({
  courseId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int().optional(),
  minMasteryPercent: z.number().int().min(0).max(100).optional(),
  minExercises: z.number().int().min(0).optional(),
});
const moduleUpdateSchema = moduleCreateSchema.omit({ courseId: true, slug: true }).partial();

router.post("/modules", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await adminService.createModule(moduleCreateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

router.put("/modules/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await adminService.updateModule(req.params.id, moduleUpdateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

router.delete("/modules/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await adminService.deleteModule(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
