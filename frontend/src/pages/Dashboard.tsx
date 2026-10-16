import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getMe,
  isAuthenticated,
  getProgress,
  getUserSkills,
  getGamificationSummary,
  logout,
  ModuleProgress,
  UserSkillItem,
  GamificationSummary,
} from "../lib/api";

interface Me {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  role: "STUDENT" | "ADMIN";
}

export default function Dashboard() {
  const [user, setUser] = useState<Me | null>(null);
  const [progress, setProgress] = useState<ModuleProgress[]>([]);
  const [skills, setSkills] = useState<UserSkillItem[]>([]);
  const [gamification, setGamification] = useState<GamificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getMe(), getProgress(), getUserSkills(), getGamificationSummary()])
      .then(([me, prog, sk, gam]) => {
        setUser(me);
        setProgress(prog);
        setSkills(sk);
        setGamification(gam);
      })
      .catch((err) => {
        // Sessão inválida (tokens limpos pelo authFetch) → login. Outros erros (API fora do ar etc.) → mensagem.
        if (!isAuthenticated()) {
          navigate("/login");
        } else {
          setLoadError(err instanceof Error ? err.message : "Não foi possível carregar o dashboard.");
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-red-600">
        <p>{loadError}</p>
        <button onClick={() => window.location.reload()} className="text-sm text-slate-500 underline">
          Tentar de novo
        </button>
      </div>
    );
  }

  const nextModule = progress.find((p) => !p.completed);
  const earnedAchievements = gamification?.achievements.filter((a) => a.earned) ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-semibold text-slate-900">CodeLearn</span>
          <div className="flex items-center gap-4">
            <Link to="/playground" className="text-sm text-slate-500 hover:text-slate-800">
              Playground
            </Link>
            <Link to="/projects" className="text-sm text-slate-500 hover:text-slate-800">
              Projetos
            </Link>
            {user?.role === "ADMIN" && (
              <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-800">
                Admin
              </Link>
            )}
            <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-800">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between mb-1">
          <h1 className="text-2xl font-semibold text-slate-900">Olá, {user?.name} 👋</h1>
          {gamification && (
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-indigo-50 text-indigo-700 font-medium px-3 py-1">
                Nível {gamification.level} · {gamification.xp} XP
              </span>
              <span className="rounded-full bg-amber-50 text-amber-700 font-medium px-3 py-1">
                🔥 {gamification.currentStreak} dia{gamification.currentStreak === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
        <p className="text-slate-500 mb-8">{user?.email}</p>

        {skills.length === 0 && (
          <Link
            to="/diagnostics"
            className="block mb-8 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-5 hover:border-indigo-400 transition"
          >
            <p className="font-medium text-indigo-900">Faça o diagnóstico inicial</p>
            <p className="text-sm text-indigo-600 mt-1">
              Poucas perguntas adaptativas para descobrir seu nível e receber uma trilha personalizada.
            </p>
          </Link>
        )}

        {nextModule && (
          <Link
            to={`/modules/${nextModule.moduleId}`}
            className="block mb-8 rounded-xl bg-indigo-600 text-white p-5 hover:bg-indigo-700 transition"
          >
            <p className="text-xs uppercase tracking-wide text-indigo-200 mb-1">Continue de onde parou</p>
            <p className="font-medium">
              {nextModule.languageName} → {nextModule.moduleTitle}
            </p>
          </Link>
        )}

        {earnedAchievements.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">Conquistas</h2>
            <div className="flex flex-wrap gap-2">
              {earnedAchievements.map((a) => (
                <span
                  key={a.slug}
                  title={a.description}
                  className="text-sm bg-white border border-slate-200 rounded-full px-3 py-1.5"
                >
                  🏅 {a.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {skills.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">Suas competências</h2>
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              {skills.map((s) => (
                <div key={s.skillId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700">{s.name}</span>
                    <span className="text-slate-500">{s.masteryPercent}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${s.masteryPercent >= 70 ? "bg-green-500" : s.masteryPercent < 50 ? "bg-red-400" : "bg-amber-400"}`}
                      style={{ width: `${s.masteryPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">Seu progresso</h2>

        {progress.length === 0 && (
          <p className="text-slate-500 text-sm">Nenhum conteúdo disponível ainda.</p>
        )}

        <div className="space-y-3">
          {progress.map((p) => (
            <Link
              key={p.moduleId}
              to={`/courses/${p.courseId}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs text-slate-400">{p.languageName} · {p.courseTitle}</p>
                  <p className="font-medium text-slate-900">{p.moduleTitle}</p>
                </div>
                <span className={`text-xs font-medium rounded-full px-2 py-1 ${p.completed ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                  {p.completed ? "Concluído" : `${p.masteryPercent}%`}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${p.completed ? "bg-green-500" : "bg-indigo-500"}`}
                  style={{ width: `${p.masteryPercent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {p.solvedExercises}/{p.totalExercises} exercícios resolvidos
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
