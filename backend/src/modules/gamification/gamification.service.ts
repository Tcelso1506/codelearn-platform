import { prisma } from "../../lib/prisma";
import { computeLevel, computeStreak, isStreakBroken } from "../../utils/gamification";

export async function awardXp(userId: string, amount: number) {
  if (amount <= 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
  });
}

/**
 * Chamado a cada ação de estudo "que conta". Atualiza a sequência de dias
 * consecutivos — no máximo 1x por dia (item 18 da spec: a gamificação não pode
 * distorcer o objetivo educacional).
 */
export async function registerDailyActivity(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastActivityDate: true, currentStreak: true, longestStreak: true },
  });
  if (!user) return;

  const next = computeStreak(user, new Date());
  if (!next.changed) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      currentStreak: next.currentStreak,
      longestStreak: next.longestStreak,
      lastActivityDate: next.lastActivityDate,
    },
  });

  if (next.currentStreak >= 3) {
    await unlockAchievement(userId, "sequencia-3-dias");
  }
}

async function unlockAchievement(userId: string, slug: string) {
  const achievement = await prisma.achievement.findUnique({ where: { slug } });
  if (!achievement) return;

  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  });
  if (existing) return;

  await prisma.userAchievement.create({ data: { userId, achievementId: achievement.id } });
  await awardXp(userId, achievement.xpReward);
}

export async function onExerciseSolvedFirstTime(userId: string) {
  await awardXp(userId, 10);
  await unlockAchievement(userId, "primeira-vitoria");
  await registerDailyActivity(userId);
}

export async function onExerciseAttempt(userId: string) {
  // Conta atividade mesmo em tentativas erradas: o esforço de tentar já sustenta o hábito.
  await registerDailyActivity(userId);
}

/** XP só na primeira vez que o usuário conclui um diagnóstico (evita "farmar" XP refazendo). */
export async function onAssessmentCompleted(userId: string, isFirstCompletion: boolean) {
  if (isFirstCompletion) {
    await awardXp(userId, 30);
  }
  await unlockAchievement(userId, "diagnostico-completo");
  await registerDailyActivity(userId);
}

export async function onProjectCompleted(userId: string) {
  await awardXp(userId, 100);
  await unlockAchievement(userId, "primeiro-projeto");
  await registerDailyActivity(userId);
}

export async function getGamificationSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, currentStreak: true, longestStreak: true, lastActivityDate: true },
  });
  if (!user) throw new Error("Usuário não encontrado.");

  const allAchievements = await prisma.achievement.findMany({ orderBy: { xpReward: "asc" } });
  const earned = await prisma.userAchievement.findMany({ where: { userId } });
  const earnedMap = new Map(earned.map((e) => [e.achievementId, e.earnedAt]));

  // Se passou mais de 1 dia desde a última atividade, a sequência já quebrou,
  // mesmo que o registro só seja zerado na próxima atividade.
  const currentStreak = isStreakBroken(user.lastActivityDate, new Date()) ? 0 : user.currentStreak;

  return {
    xp: user.xp,
    level: computeLevel(user.xp),
    currentStreak,
    longestStreak: user.longestStreak,
    achievements: allAchievements.map((a) => ({
      slug: a.slug,
      name: a.name,
      description: a.description,
      xpReward: a.xpReward,
      earned: earnedMap.has(a.id),
      earnedAt: earnedMap.get(a.id) ?? null,
    })),
  };
}
