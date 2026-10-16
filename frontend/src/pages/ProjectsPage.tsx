import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listProjects, getProjectProgress, ProjectSummary, ProjectProgressItem } from "../lib/api";

const levelLabel: Record<string, string> = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};

const statusLabel: Record<string, { text: string; className: string }> = {
  NOT_STARTED: { text: "Não iniciado", className: "bg-slate-100 text-slate-600" },
  IN_PROGRESS: { text: "Em andamento", className: "bg-amber-50 text-amber-700" },
  COMPLETED: { text: "Concluído", className: "bg-green-50 text-green-700" },
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [progress, setProgress] = useState<ProjectProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([listProjects(), getProjectProgress()])
      .then(([p, prog]) => {
        setProjects(p);
        setProgress(prog);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;
  }

  const progressByProject = new Map(progress.map((p) => [p.projectId, p]));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button onClick={() => navigate("/dashboard")} className="text-sm text-slate-500 hover:text-slate-800">
            ← Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Projetos de portfólio</h1>
        <p className="text-slate-500 mb-8">
          Projetos progressivos para você construir e colocar no seu GitHub.
        </p>

        <div className="space-y-3">
          {projects.map((project) => {
            const status = progressByProject.get(project.id)?.status ?? "NOT_STARTED";
            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition"
              >
                <div>
                  <p className="text-xs text-slate-400">{project.language.name} · {levelLabel[project.level]}</p>
                  <p className="font-medium text-slate-900">{project.title}</p>
                </div>
                <span className={`text-xs font-medium rounded-full px-2 py-1 ${statusLabel[status].className}`}>
                  {statusLabel[status].text}
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
