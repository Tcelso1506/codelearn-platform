import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";

export async function listLanguages() {
  return prisma.language.findMany({
    orderBy: { name: "asc" },
    include: {
      courses: {
        orderBy: { order: "asc" },
        select: { id: true, slug: true, title: true, description: true, order: true },
      },
    },
  });
}

export async function getLanguage(id: string) {
  const language = await prisma.language.findUnique({
    where: { id },
    include: {
      courses: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!language) {
    throw new HttpError(404, "Linguagem não encontrada.");
  }

  return language;
}

export async function listCourses() {
  return prisma.course.findMany({
    orderBy: { order: "asc" },
    include: { language: { select: { id: true, slug: true, name: true } } },
  });
}

export async function getCourse(id: string) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      language: { select: { id: true, slug: true, name: true } },
      modules: {
        orderBy: { order: "asc" },
        select: { id: true, slug: true, title: true, description: true, order: true },
      },
    },
  });

  if (!course) {
    throw new HttpError(404, "Curso não encontrado.");
  }

  return course;
}

export async function getModule(id: string) {
  const moduleData = await prisma.module.findUnique({
    where: { id },
    include: {
      lessons: { orderBy: { order: "asc" } },
      exercises: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          type: true,
          difficulty: true,
          order: true,
          prompt: true,
          // Nunca expor correctAnswer/explanation antes da submissão.
        },
      },
      course: { select: { id: true, title: true, languageId: true } },
    },
  });

  if (!moduleData) {
    throw new HttpError(404, "Módulo não encontrado.");
  }

  return moduleData;
}
