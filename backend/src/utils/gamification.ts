const DAY_MS = 24 * 60 * 60 * 1000;

export function computeLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

/** Meia-noite UTC do dia de `date` (o streak conta dias, não horas). */
export function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
}

/**
 * Calcula o novo estado do streak para uma atividade em `now`.
 * - primeira atividade ou lacuna > 1 dia: streak volta a 1
 * - dia seguinte ao último: streak + 1
 * - mesmo dia: nada muda (`changed: false`) — o streak conta 1x por dia.
 */
export function computeStreak(state: StreakState, now: Date): StreakState & { changed: boolean } {
  const today = startOfDayUTC(now);

  if (!state.lastActivityDate) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(state.longestStreak, 1),
      lastActivityDate: today,
      changed: true,
    };
  }

  const diffDays = Math.round((today.getTime() - startOfDayUTC(state.lastActivityDate).getTime()) / DAY_MS);

  if (diffDays <= 0) {
    return { ...state, changed: false };
  }

  const currentStreak = diffDays === 1 ? state.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(state.longestStreak, currentStreak),
    lastActivityDate: today,
    changed: true,
  };
}

/** A sequência quebrou se passou mais de 1 dia inteiro desde a última atividade. */
export function isStreakBroken(lastActivityDate: Date | null, now: Date): boolean {
  if (!lastActivityDate) return false;
  const diffDays = Math.round((startOfDayUTC(now).getTime() - startOfDayUTC(lastActivityDate).getTime()) / DAY_MS);
  return diffDays > 1;
}
