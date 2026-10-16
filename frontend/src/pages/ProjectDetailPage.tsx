import { useEffect, useState, ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getProject,
  getProjectProgress,
  startProject,
  completeProject,
  ProjectDetail,
  ProjectProgressItem,
} from "../lib/api";

const levelLabel: Record<string, string> = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-2">{title}</h2>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [progress, setProgress] = useState<ProjectProgressItem | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function load() {
    if (!projectId) return;
    const [p, allProgress] = await Promise.all([getProject(projectId), getProjectProgress()]);
    setProject(p);
    const mine = allProgress.find((item) => item.projectId === projectId) ?? null;
    setProgress(mine);
    setRepoUrl(mine?.repoUrl ?? "");
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar projeto."));
  }, [projectId]);

  async function handleStart() {
    if (!project) return;
    setBusy(true);
    try {
      await startProject(project.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar projeto.");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (!project) return;
    setBusy(true);
    try {
      await completeProject(project.id, repoUrl || undefined);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao concluir projeto.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !project) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }

  if (!project) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;
  }

  const status = progress?.status ?? "NOT_STARTED";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <button onClick={() => navigate("/projects")} className="text-sm text-slate-500 hover:text-slate-800">
            ← Todos os projetos
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-sm font-medium text-indigo-600 mb-1">
          {project.language.name} · {levelLabel[project.level]}
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 mb-4">{project.title}</h1>

        <Section title="Objetivo">
          <p className="text-sm text-slate-700">{project.objective}</p>
        </Section>

        <Section title="O problema">
          <p className="text-sm text-slate-700">{project.problem}</p>
        </Section>

        <Section title="Stack">
          <p className="text-sm text-slate-700">{project.stack}</p>
        </Section>

        <Section title="Requisitos">
          <BulletList items={project.requirements} />
        </Section>

        <Section title="Funcionalidades">
          <BulletList items={project.features} />
        </Section>

        {project.bonusChallenges && (
          <Section title="Desafios extras">
            <BulletList items={project.bonusChallenges} />
          </Section>
        )}

        <Section title="Critérios de sucesso">
          <BulletList items={project.successCriteria} />
        </Section>

        <Section title="Estrutura sugerida">
          <pre className="bg-slate-900 text-slate-100 text-sm rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
            {project.suggestedStructure}
          </pre>
        </Section>

        <Section title="README sugerido">
          <pre className="bg-slate-50 border border-slate-200 text-sm rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
            {project.suggestedReadme}
          </pre>
        </Section>

        {project.futureImprovements && (
          <Section title="Melhorias futuras">
            <BulletList items={project.futureImprovements} />
          </Section>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-5 mt-8">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {status === "NOT_STARTED" && (
            <button
              onClick={handleStart}
              disabled={busy}
              className="rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              Começar projeto
            </button>
          )}

          {status !== "NOT_STARTED" && (
            <>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
                Link do repositório no GitHub (opcional)
              </label>
              <input
                type="url"
                placeholder="https://github.com/seu-usuario/seu-projeto"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="w-full mb-3 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {status !== "COMPLETED" ? (
                <button
                  onClick={handleComplete}
                  disabled={busy}
                  className="rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                >
                  Marcar como concluído
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-green-700">✅ Projeto concluído</span>
                  <button
                    onClick={handleComplete}
                    disabled={busy}
                    className="text-sm text-slate-500 hover:text-slate-800"
                  >
                    Atualizar link do repositório
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
