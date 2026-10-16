import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { getModule, ModuleDetail } from "../lib/api";

const difficultyLabel: Record<string, string> = {
  EASY: "Fácil",
  MEDIUM: "Médio",
  HARD: "Difícil",
};

export default function ModulePage() {
  const { moduleId } = useParams();
  const [moduleData, setModuleData] = useState<ModuleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!moduleId) return;
    getModule(moduleId)
      .then(setModuleData)
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar módulo."));
  }, [moduleId]);

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }

  if (!moduleData) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate(`/courses/${moduleData.course.id}`)}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ← {moduleData.course.title}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">{moduleData.title}</h1>
        <p className="text-slate-500 mb-8">{moduleData.description}</p>

        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">Aulas</h2>
          <div className="space-y-3">
            {moduleData.lessons.map((lesson) => (
              <details key={lesson.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <summary className="font-medium text-slate-900 cursor-pointer">{lesson.title}</summary>
                {/* react-markdown não renderiza HTML cru por padrão — seguro contra XSS vindo do conteúdo. */}
                <div className="lesson mt-3 text-sm text-slate-700">
                  <ReactMarkdown>{lesson.content}</ReactMarkdown>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">Exercícios</h2>
          <div className="space-y-3">
            {moduleData.exercises.map((ex, idx) => (
              <Link
                key={ex.id}
                to={`/exercises/${ex.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition"
              >
                <div>
                  <p className="text-sm text-slate-400">Exercício {idx + 1}</p>
                  <p className="text-slate-800">{ex.prompt}</p>
                </div>
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full px-2 py-1">
                  {difficultyLabel[ex.difficulty] ?? ex.difficulty}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
