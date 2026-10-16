import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { getUserProgress } from "../progress/progress.service";
import * as gamification from "../gamification/gamification.service";
import { answersMatch } from "../../utils/answer";

const PASS_THRESHOLD = 70; // mastery >= isto = "ponto forte"
const GAP_THRESHOLD = 50; // mastery < isto = "lacuna"
const TIER_CONTINUE_RATE = 0.5; // < 50% de skills "passadas" no tier = para o diagnóstico aqui

function sanitizeQuestion(question: {
  id: string;
  type: string;
  difficulty: string;
  prompt: string;
  starterCode: string | null;
  options: unknown;
}) {
  return {
    id: question.id,
    type: question.type,
    difficulty: question.difficulty,
    prompt: question.prompt,
    starterCode: question.starterCode,
    options: question.options,
    // correctAnswer e explanation nunca são expostos antes da resposta.
  };
}

async function getSkillSequence(languageId: string) {
  return prisma.skill.findMany({
    where: { languageId },
    orderBy: [{ tier: "asc" }, { order: "asc" }],
  });
}

function isReadyToFinish(attempt: { stoppedEarly: boolean; cursorSkillIndex: number }, totalSkills: number) {
  return attempt.stoppedEarly || attempt.cursorSkillIndex >= totalSkills;
}

async function getQuestionFor(skillId: string, order: number) {
  const question = await prisma.assessmentQuestion.findUnique({
    where: { skillId_order: { skillId, order } },
  });
  if (!question) {
    throw new HttpError(500, "Banco de perguntas de diagnóstico incompleto para esta competência.");
  }
  return question;
}

async function currentQuestionPayload(attempt: {
  id: string;
  languageId: string;
  cursorSkillIndex: number;
  cursorQuestionOrder: number;
}) {
  const sequence = await getSkillSequence(attempt.languageId);
  const skill = sequence[attempt.cursorSkillIndex];
  const question = await getQuestionFor(skill.id, attempt.cursorQuestionOrder);

  return {
    attemptId: attempt.id,
    status: "in_progress" as const,
    skill: { id: skill.id, name: skill.name, tier: skill.tier },
    progress: { currentSkillIndex: attempt.cursorSkillIndex, totalSkills: sequence.length },
    question: sanitizeQuestion(question),
  };
}

export async function startAssessment(userId: string, languageId: string) {
  const language = await prisma.language.findUnique({ where: { id: languageId } });
  if (!language) {
    throw new HttpError(404, "Linguagem não encontrada.");
  }

  const sequence = await getSkillSequence(languageId);
  if (sequence.length === 0) {
    throw new HttpError(409, "Diagnóstico ainda não está disponível para esta linguagem.");
  }

  const existing = await prisma.assessmentAttempt.findFirst({
    where: { userId, languageId, status: "IN_PROGRESS" },
  });

  if (existing) {
    if (isReadyToFinish(existing, sequence.length)) {
      return { attemptId: existing.id, status: "ready_to_finish" as const };
    }
    return currentQuestionPayload(existing);
  }

  const attempt = await prisma.assessmentAttempt.create({
    data: { userId, languageId, cursorSkillIndex: 0, cursorQuestionOrder: 1 },
  });

  return currentQuestionPayload(attempt);
}

async function computeSkillPassRate(attemptId: string, skillIds: string[]) {
  if (skillIds.length === 0) return 1;

  const answers = await prisma.assessmentAnswer.findMany({
    where: { attemptId, skillId: { in: skillIds } },
  });

  let passed = 0;
  for (const skillId of skillIds) {
    const skillAnswers = answers.filter((a) => a.skillId === skillId);
    const correct = skillAnswers.filter((a) => a.isCorrect).length;
    if (skillAnswers.length > 0 && correct / skillAnswers.length >= 0.5) {
      passed += 1;
    }
  }

  return passed / skillIds.length;
}

export async function answerAssessment(userId: string, attemptId: string, questionId: string, answerValue: string) {
  const attempt = await prisma.assessmentAttempt.findUnique({ where: { id: attemptId } });

  if (!attempt || attempt.userId !== userId) {
    throw new HttpError(404, "Tentativa de diagnóstico não encontrada.");
  }
  if (attempt.status !== "IN_PROGRESS") {
    throw new HttpError(409, "Este diagnóstico já foi finalizado.");
  }

  const sequence = await getSkillSequence(attempt.languageId);
  if (isReadyToFinish(attempt, sequence.length)) {
    throw new HttpError(409, "O diagnóstico já terminou — finalize para ver o resultado.");
  }
  const currentSkill = sequence[attempt.cursorSkillIndex];
  const expectedQuestion = await getQuestionFor(currentSkill.id, attempt.cursorQuestionOrder);

  if (expectedQuestion.id !== questionId) {
    throw new HttpError(409, "Esta pergunta não corresponde ao passo atual do diagnóstico.");
  }

  const isCorrect = answersMatch(answerValue, expectedQuestion.correctAnswer);

  await prisma.assessmentAnswer.create({
    data: {
      attemptId: attempt.id,
      questionId: expectedQuestion.id,
      skillId: currentSkill.id,
      answer: answerValue,
      isCorrect,
    },
  });

  // Algoritmo adaptativo (item 8): acertou a pergunta de triagem (order 1) →
  // pula a de aprofundamento e avança de competência. Errou → aplica a
  // pergunta mais profunda (order 2) da mesma competência antes de avançar.
  let nextSkillIndex = attempt.cursorSkillIndex;
  let nextQuestionOrder = attempt.cursorQuestionOrder;

  if (attempt.cursorQuestionOrder === 1 && isCorrect) {
    nextSkillIndex += 1;
    nextQuestionOrder = 1;
  } else if (attempt.cursorQuestionOrder === 1 && !isCorrect) {
    nextQuestionOrder = 2;
  } else {
    nextSkillIndex += 1;
    nextQuestionOrder = 1;
  }

  const crossedIntoNewTier =
    nextSkillIndex < sequence.length && sequence[nextSkillIndex].tier !== currentSkill.tier;
  const finishedSequence = nextSkillIndex >= sequence.length;

  let stoppedEarly = false;
  if (crossedIntoNewTier || finishedSequence) {
    const tierSkillIds = sequence.filter((s) => s.tier === currentSkill.tier).map((s) => s.id);
    const passRate = await computeSkillPassRate(attempt.id, tierSkillIds);
    if (passRate < TIER_CONTINUE_RATE) {
      stoppedEarly = true;
    }
  }

  if (finishedSequence || stoppedEarly) {
    await prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        cursorSkillIndex: nextSkillIndex,
        cursorQuestionOrder: nextQuestionOrder,
        stoppedEarly,
      },
    });
    return { status: "ready_to_finish" as const, wasCorrect: isCorrect };
  }

  const updatedAttempt = await prisma.assessmentAttempt.update({
    where: { id: attempt.id },
    data: { cursorSkillIndex: nextSkillIndex, cursorQuestionOrder: nextQuestionOrder },
  });

  const nextPayload = await currentQuestionPayload(updatedAttempt);
  return { ...nextPayload, wasCorrect: isCorrect };
}

export async function finishAssessment(userId: string, attemptId: string) {
  const attempt = await prisma.assessmentAttempt.findUnique({ where: { id: attemptId } });

  if (!attempt || attempt.userId !== userId) {
    throw new HttpError(404, "Tentativa de diagnóstico não encontrada.");
  }

  if (attempt.status === "COMPLETED") {
    return attempt.resultSummary;
  }

  const sequence = await getSkillSequence(attempt.languageId);
  if (!isReadyToFinish(attempt, sequence.length)) {
    throw new HttpError(409, "O diagnóstico ainda não terminou — responda todas as perguntas pendentes.");
  }
  const attemptedSkills = sequence.slice(0, attempt.cursorSkillIndex);

  const skillResults: { skillId: string; name: string; tier: number; masteryPercent: number }[] = [];

  for (const skill of attemptedSkills) {
    const answers = await prisma.assessmentAnswer.findMany({
      where: { attemptId: attempt.id, skillId: skill.id },
    });
    const correct = answers.filter((a) => a.isCorrect).length;
    const masteryPercent = answers.length === 0 ? 0 : Math.round((correct / answers.length) * 100);

    skillResults.push({ skillId: skill.id, name: skill.name, tier: skill.tier, masteryPercent });

    await prisma.userSkill.upsert({
      where: { userId_skillId: { userId, skillId: skill.id } },
      update: { masteryPercent, assessedAt: new Date() },
      create: { userId, skillId: skill.id, masteryPercent },
    });
  }

  const tiersAttempted = new Set(skillResults.map((s) => s.tier));
  const tierPassed = (tier: number) => {
    const skillsInTier = skillResults.filter((s) => s.tier === tier);
    if (skillsInTier.length === 0) return false;
    const avg = skillsInTier.reduce((sum, s) => sum + s.masteryPercent, 0) / skillsInTier.length;
    return avg >= 50;
  };

  let level: "Iniciante" | "Intermediário" | "Avançado" = "Iniciante";
  if (tiersAttempted.has(3) && tierPassed(1) && tierPassed(2) && tierPassed(3)) {
    level = "Avançado";
  } else if (tiersAttempted.has(2) && tierPassed(1) && tierPassed(2)) {
    level = "Intermediário";
  }

  const strengths = skillResults.filter((s) => s.masteryPercent >= PASS_THRESHOLD).map((s) => s.name);
  const gaps = skillResults.filter((s) => s.masteryPercent < GAP_THRESHOLD).map((s) => s.name);

  // Recomendação de trilha: como o catálogo de conteúdo desta fase ainda tem
  // um módulo por linguagem, a "trilha personalizada" hoje aponta para o
  // próximo módulo incompleto real (Fase 2) — nunca inventamos módulos que
  // não existem no catálogo.
  const progress = await getUserProgress(userId);
  const nextModule = progress.find((p) => p.languageId === attempt.languageId && !p.completed);

  const resultSummary = {
    level,
    skills: skillResults.map((s) => ({ name: s.name, tier: s.tier, masteryPercent: s.masteryPercent })),
    strengths,
    gaps,
    stoppedEarly: attempt.stoppedEarly,
    recommendation: nextModule
      ? { moduleId: nextModule.moduleId, moduleTitle: nextModule.moduleTitle }
      : null,
  };

  const previouslyCompleted = await prisma.assessmentAttempt.count({
    where: { userId, status: "COMPLETED" },
  });

  await prisma.assessmentAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "COMPLETED",
      resultLevel: level,
      resultSummary,
      finishedAt: new Date(),
    },
  });

  await gamification.onAssessmentCompleted(userId, previouslyCompleted === 0);

  return resultSummary;
}

export async function getAssessmentStatus(userId: string, attemptId: string) {
  const attempt = await prisma.assessmentAttempt.findUnique({ where: { id: attemptId } });

  if (!attempt || attempt.userId !== userId) {
    throw new HttpError(404, "Tentativa de diagnóstico não encontrada.");
  }

  if (attempt.status === "COMPLETED") {
    return { status: "completed" as const, result: attempt.resultSummary };
  }

  const sequence = await getSkillSequence(attempt.languageId);
  if (isReadyToFinish(attempt, sequence.length)) {
    return { status: "ready_to_finish" as const };
  }

  return currentQuestionPayload(attempt);
}
