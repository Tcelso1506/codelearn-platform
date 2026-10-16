import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";

// Escopo desta fase: Language, Course e Module — o início da hierarquia de
// conteúdo. Lesson, Exercise e Project seguem exatamente o mesmo padrão
// (create/update/delete simples sobre a tabela, com o mesmo shape de rota) e
// ficam para uma próxima iteração deste mesmo painel, documentado em
// docs/ROADMAP.md — implementar todos de uma vez só infla o código sem
// agregar nada de novo ao padrão já demonstrado aqui.

export async function createLanguage(data: { slug: string; name: string; description: string }) {
  const existing = await prisma.language.findUnique({ where: { slug: data.slug } });
  if (existing) throw new HttpError(409, "Já existe uma linguagem com este slug.");
  return prisma.language.create({ data });
}

export async function updateLanguage(id: string, data: Partial<{ name: string; description: string }>) {
  const existing = await prisma.language.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Linguagem não encontrada.");
  return prisma.language.update({ where: { id }, data });
}

export async function deleteLanguage(id: string) {
  const existing = await prisma.language.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Linguagem não encontrada.");
  // onDelete: Cascade no schema remove cursos/módulos/exercícios/projetos
  // dependentes — intencional para um painel admin, mas por isso mesmo vale
  // confirmar do lado do frontend antes de chamar isto.
  await prisma.language.delete({ where: { id } });
}

export async function createCourse(data: {
  languageId: string;
  slug: string;
  title: string;
  description: string;
  order?: number;
}) {
  const language = await prisma.language.findUnique({ where: { id: data.languageId } });
  if (!language) throw new HttpError(404, "Linguagem não encontrada.");
  return prisma.course.create({ data });
}

export async function updateCourse(
  id: string,
  data: Partial<{ title: string; description: string; order: number }>
) {
  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Curso não encontrado.");
  return prisma.course.update({ where: { id }, data });
}

export async function deleteCourse(id: string) {
  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Curso não encontrado.");
  await prisma.course.delete({ where: { id } });
}

export async function createModule(data: {
  courseId: string;
  slug: string;
  title: string;
  description: string;
  order?: number;
  minMasteryPercent?: number;
  minExercises?: number;
}) {
  const course = await prisma.course.findUnique({ where: { id: data.courseId } });
  if (!course) throw new HttpError(404, "Curso não encontrado.");
  return prisma.module.create({ data });
}

export async function updateModule(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    order: number;
    minMasteryPercent: number;
    minExercises: number;
  }>
) {
  const existing = await prisma.module.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Módulo não encontrado.");
  return prisma.module.update({ where: { id }, data });
}

export async function deleteModule(id: string) {
  const existing = await prisma.module.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Módulo não encontrado.");
  await prisma.module.delete({ where: { id } });
}
