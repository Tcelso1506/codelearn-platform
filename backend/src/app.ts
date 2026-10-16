import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redisConnection } from "./lib/queue";
import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import contentRoutes from "./modules/content/content.routes";
import exercisesRoutes from "./modules/exercises/exercises.routes";
import progressRoutes from "./modules/progress/progress.routes";
import assessmentsRoutes from "./modules/assessments/assessment.routes";
import skillsRoutes from "./modules/skills/skills.routes";
import codeRoutes from "./modules/code/code.routes";
import projectsRoutes from "./modules/projects/projects.routes";
import gamificationRoutes from "./modules/gamification/gamification.routes";
import adminRoutes from "./modules/admin/admin.routes";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "100kb" }));

  // Cada requisição ganha um ID (aceita um já existente do cliente/proxy, ex.
  // um API Gateway) — item 21 da spec: rastreabilidade entre logs e, no
  // futuro, entre serviços (backend → code-runner) via tracing.
  app.use((req, res, next) => {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    res.setHeader("x-request-id", requestId);
    (req as express.Request & { id: string }).id = requestId;
    next();
  });

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request & { id: string }).id,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    })
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
  });

  // Readiness: além do processo estar de pé, checa se as dependências (banco,
  // fila) respondem — o que um health check simples não cobre, e o que um
  // orquestrador (k8s, ECS) usa pra decidir se manda tráfego pra essa réplica.
  app.get("/health/ready", async (_req, res) => {
    const checks: Record<string, "ok" | "fail"> = { database: "ok", redis: "ok" };

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.database = "fail";
    }

    try {
      await redisConnection.ping();
    } catch {
      checks.redis = "fail";
    }

    const allOk = Object.values(checks).every((v) => v === "ok");
    res.status(allOk ? 200 : 503).json({ status: allOk ? "ready" : "not_ready", checks });
  });

  app.use("/auth", authRoutes);
  app.use("/users", usersRoutes);
  // contentRoutes já define os caminhos completos (/languages, /courses, /modules).
  app.use(contentRoutes);
  app.use("/exercises", exercisesRoutes);
  app.use("/progress", progressRoutes);
  app.use("/assessments", assessmentsRoutes);
  app.use("/skills", skillsRoutes);
  app.use("/code", codeRoutes);
  app.use("/projects", projectsRoutes);
  app.use("/gamification", gamificationRoutes);
  app.use("/admin", adminRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: "Rota não encontrada." });
  });

  app.use(errorHandler);

  return app;
}
