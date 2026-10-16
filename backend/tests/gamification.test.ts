import { describe, expect, it } from "vitest";
import { computeLevel, computeStreak, isStreakBroken } from "../src/utils/gamification";

const d = (iso: string) => new Date(iso);

describe("computeLevel", () => {
  it("começa no nível 1 e sobe a cada 100 XP", () => {
    expect(computeLevel(0)).toBe(1);
    expect(computeLevel(99)).toBe(1);
    expect(computeLevel(100)).toBe(2);
    expect(computeLevel(250)).toBe(3);
  });
});

describe("computeStreak", () => {
  it("primeira atividade inicia o streak em 1", () => {
    const r = computeStreak({ currentStreak: 0, longestStreak: 0, lastActivityDate: null }, d("2026-05-10T15:00:00Z"));
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(1);
    expect(r.changed).toBe(true);
  });

  it("várias atividades no mesmo dia contam uma vez só", () => {
    const state = { currentStreak: 2, longestStreak: 2, lastActivityDate: d("2026-05-10T00:00:00Z") };
    const r = computeStreak(state, d("2026-05-10T23:59:00Z"));
    expect(r.changed).toBe(false);
    expect(r.currentStreak).toBe(2);
  });

  it("dia seguinte incrementa o streak e atualiza o recorde", () => {
    const state = { currentStreak: 2, longestStreak: 2, lastActivityDate: d("2026-05-10T00:00:00Z") };
    const r = computeStreak(state, d("2026-05-11T08:00:00Z"));
    expect(r.currentStreak).toBe(3);
    expect(r.longestStreak).toBe(3);
  });

  it("lacuna de mais de um dia zera para 1, mas preserva o recorde", () => {
    const state = { currentStreak: 5, longestStreak: 5, lastActivityDate: d("2026-05-10T00:00:00Z") };
    const r = computeStreak(state, d("2026-05-13T08:00:00Z"));
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(5);
  });
});

describe("isStreakBroken", () => {
  it("não considera quebrado hoje nem ontem", () => {
    expect(isStreakBroken(d("2026-05-10T00:00:00Z"), d("2026-05-10T20:00:00Z"))).toBe(false);
    expect(isStreakBroken(d("2026-05-10T00:00:00Z"), d("2026-05-11T20:00:00Z"))).toBe(false);
  });

  it("considera quebrado após um dia inteiro sem atividade", () => {
    expect(isStreakBroken(d("2026-05-10T00:00:00Z"), d("2026-05-12T01:00:00Z"))).toBe(true);
  });

  it("sem atividade registrada não há o que quebrar", () => {
    expect(isStreakBroken(null, d("2026-05-12T01:00:00Z"))).toBe(false);
  });
});
