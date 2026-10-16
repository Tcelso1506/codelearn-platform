import { prisma } from "../../lib/prisma";

export async function getUserSkills(userId: string) {
  const skills = await prisma.userSkill.findMany({
    where: { userId },
    include: { skill: { include: { language: { select: { id: true, name: true } } } } },
    orderBy: [{ skill: { tier: "asc" } }, { skill: { order: "asc" } }],
  });

  return skills.map((s) => ({
    skillId: s.skillId,
    name: s.skill.name,
    tier: s.skill.tier,
    masteryPercent: s.masteryPercent,
    languageId: s.skill.language.id,
    languageName: s.skill.language.name,
    assessedAt: s.assessedAt,
  }));
}
