import { prisma } from "../../lib/prisma";

export interface ModuleProgress {
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  languageId: string;
  languageName: string;
  totalExercises: number;
  solvedExercises: number;
  masteryPercent: number;
  minMasteryPercent: number;
  minExercises: number;
  completed: boolean;
}

export async function getUserProgress(userId: string): Promise<ModuleProgress[]> {
  const modules = await prisma.module.findMany({
    orderBy: { order: "asc" },
    include: {
      course: { include: { language: true } },
      exercises: {
        select: {
          id: true,
          userProgress: {
            where: { userId },
            select: { solved: true },
          },
        },
      },
    },
  });

  return modules.map((mod) => {
    const totalExercises = mod.exercises.length;
    const solvedExercises = mod.exercises.filter((ex) => ex.userProgress[0]?.solved).length;
    const masteryPercent = totalExercises === 0 ? 0 : Math.round((solvedExercises / totalExercises) * 100);
    const requiredExercises = Math.min(mod.minExercises, totalExercises);
    const completed = masteryPercent >= mod.minMasteryPercent && solvedExercises >= requiredExercises;

    return {
      moduleId: mod.id,
      moduleTitle: mod.title,
      courseId: mod.course.id,
      courseTitle: mod.course.title,
      languageId: mod.course.language.id,
      languageName: mod.course.language.name,
      totalExercises,
      solvedExercises,
      masteryPercent,
      minMasteryPercent: mod.minMasteryPercent,
      minExercises: mod.minExercises,
      completed,
    };
  });
}
