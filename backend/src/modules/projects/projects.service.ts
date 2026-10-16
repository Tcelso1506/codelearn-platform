import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import * as gamification from "../gamification/gamification.service";

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: [{ level: "asc" }, { order: "asc" }],
    include: { language: { select: { id: true, name: true } } },
  });
}

export async function getProject(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { language: { select: { id: true, name: true } } },
  });
  if (!project) {
    throw new HttpError(404, "Projeto não encontrado.");
  }
  return project;
}

export async function getUserProjectProgress(userId: string) {
  const progress = await prisma.projectProgress.findMany({
    where: { userId },
    include: { project: { select: { id: true, title: true, level: true } } },
  });

  return progress.map((p) => ({
    projectId: p.projectId,
    title: p.project.title,
    level: p.project.level,
    status: p.status,
    repoUrl: p.repoUrl,
    startedAt: p.startedAt,
    completedAt: p.completedAt,
  }));
}

export async function startProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new HttpError(404, "Projeto não encontrado.");
  }

  const progress = await prisma.projectProgress.upsert({
    where: { userId_projectId: { userId, projectId } },
    update: {}, // já iniciado ou concluído — idempotente, não regride status
    create: { userId, projectId, status: "IN_PROGRESS", startedAt: new Date() },
  });

  return progress;
}

export async function completeProject(userId: string, projectId: string, repoUrl?: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new HttpError(404, "Projeto não encontrado.");
  }

  const existing = await prisma.projectProgress.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  const wasAlreadyCompleted = existing?.status === "COMPLETED";

  const progress = await prisma.projectProgress.upsert({
    where: { userId_projectId: { userId, projectId } },
    update: {
      status: "COMPLETED",
      completedAt: new Date(),
      repoUrl: repoUrl ?? existing?.repoUrl ?? null,
    },
    create: {
      userId,
      projectId,
      status: "COMPLETED",
      startedAt: new Date(),
      completedAt: new Date(),
      repoUrl: repoUrl ?? null,
    },
  });

  if (!wasAlreadyCompleted) {
    await gamification.onProjectCompleted(userId);
  }

  return progress;
}
