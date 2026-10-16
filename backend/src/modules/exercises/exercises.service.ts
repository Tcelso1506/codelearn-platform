import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import * as gamification from "../gamification/gamification.service";
import { answersMatch } from "../../utils/answer";

export async function getExercise(id: string) {
  const exercise = await prisma.exercise.findUnique({
    where: { id },
    select: {
      id: true,
      moduleId: true,
      type: true,
      difficulty: true,
      prompt: true,
      starterCode: true,
      options: true,
      hint: true,
      // correctAnswer e explanation nunca são expostos antes da submissão.
    },
  });

  if (!exercise) {
    throw new HttpError(404, "Exercício não encontrado.");
  }

  return exercise;
}

/**
 * Feedback em camadas (item 12 da spec): nunca entrega a solução de imediato.
 * Nesta fase, sem execução de código real, o "possível motivo do erro" é
 * derivado do tipo de exercício e da resposta dada — a análise semântica mais
 * rica (ligada a padrões de erro reais) chega com o motor de aprendizagem
 * completo e o code-runner (Fases 3/4).
 */
function buildFeedback(isCorrect: boolean, hint: string | null, explanation: string) {
  if (isCorrect) {
    return { level: "correct" as const, message: "Resposta correta.", explanation };
  }
  if (hint) {
    return { level: "hint" as const, message: hint };
  }
  return {
    level: "explanation" as const,
    message: "Não foi dessa vez. Releia o enunciado e tente identificar onde o raciocínio diverge do esperado.",
  };
}

export async function submitExercise(userId: string, exerciseId: string, answer: string) {
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });

  if (!exercise) {
    throw new HttpError(404, "Exercício não encontrado.");
  }

  const isCorrect = answersMatch(answer, exercise.correctAnswer);

  const previousProgress = await prisma.userExerciseProgress.findUnique({
    where: { userId_exerciseId: { userId, exerciseId } },
  });
  const wasAlreadySolved = previousProgress?.solved ?? false;

  const progress = await prisma.userExerciseProgress.upsert({
    where: { userId_exerciseId: { userId, exerciseId } },
    update: {
      attempts: { increment: 1 },
      solved: isCorrect ? true : undefined,
      lastAnswer: answer,
      lastAttemptAt: new Date(),
    },
    create: {
      userId,
      exerciseId,
      attempts: 1,
      solved: isCorrect,
      lastAnswer: answer,
      lastAttemptAt: new Date(),
    },
  });

  if (isCorrect && !wasAlreadySolved) {
    await gamification.onExerciseSolvedFirstTime(userId);
  } else {
    await gamification.onExerciseAttempt(userId);
  }

  const feedback = buildFeedback(isCorrect, exercise.hint, exercise.explanation);

  return {
    isCorrect,
    attempts: progress.attempts,
    feedback,
    // A explicação completa só é revelada quando o exercício é resolvido
    // ou após algumas tentativas — aqui, simplificado: revelada ao acertar.
    explanation: isCorrect ? exercise.explanation : undefined,
  };
}
