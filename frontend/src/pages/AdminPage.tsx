import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listLanguages, Language, authFetchJson } from "../lib/api";

export default function AdminPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<"language" | "course" | "module" | null>(null);
  const navigate = useNavigate();

  const [langForm, setLangForm] = useState({ slug: "", name: "", description: "" });
  const [courseForm, setCourseForm] = useState({ languageId: "", slug: "", title: "", description: "" });
  const [moduleForm, setModuleForm] = useState({ courseId: "", slug: "", title: "", description: "" });

  async function load() {
    try {
      setLanguages(await listLanguages());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar conteúdo. Você é administrador?");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateLanguage(e: FormEvent) {
    e.preventDefault();
    setCreating("language");
    setError(null);
    try {
      await authFetchJson("/admin/languages", "POST", langForm);
      setLangForm({ slug: "", name: "", description: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar linguagem.");
    } finally {
      setCreating(null);
    }
  }

  async function handleCreateCourse(e: FormEvent) {
    e.preventDefault();
    setCreating("course");
    setError(null);
    try {
      await authFetchJson("/admin/courses", "POST", courseForm);
      setCourseForm({ languageId: "", slug: "", title: "", description: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar curso.");
    } finally {
      setCreating(null);
    }
  }

  async function handleCreateModule(e: FormEvent) {
    e.preventDefault();
    setCreating("module");
    setError(null);
    try {
      await authFetchJson("/admin/modules", "POST", moduleForm);
      setModuleForm({ courseId: "", slug: "", title: "", description: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar módulo.");
    } finally {
      setCreating(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <button onClick={() => navigate("/dashboard")} className="text-sm text-slate-500 hover:text-slate-800">
            ← Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Administração de conteúdo</h1>
        <p className="text-slate-500 mb-6">
          Cadastro de linguagens, cursos e módulos. Aulas, exercícios e projetos seguem o mesmo padrão de API e
          entram numa próxima iteração deste painel.
        </p>

        {error && (
          <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
          <h2 className="font-medium text-slate-900 mb-3">Nova linguagem</h2>
          <form onSubmit={handleCreateLanguage} className="grid grid-cols-3 gap-3">
            <input
              placeholder="slug (ex: javascript)"
              required
              value={langForm.slug}
              onChange={(e) => setLangForm({ ...langForm, slug: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Nome"
              required
              value={langForm.name}
              onChange={(e) => setLangForm({ ...langForm, name: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Descrição"
              required
              value={langForm.description}
              onChange={(e) => setLangForm({ ...langForm, description: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creating === "language"}
              className="col-span-3 rounded-md bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              Criar linguagem
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
          <h2 className="font-medium text-slate-900 mb-3">Novo curso</h2>
          <form onSubmit={handleCreateCourse} className="grid grid-cols-2 gap-3">
            <select
              required
              value={courseForm.languageId}
              onChange={(e) => setCourseForm({ ...courseForm, languageId: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Linguagem...</option>
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <input
              placeholder="slug"
              required
              value={courseForm.slug}
              onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Título"
              required
              value={courseForm.title}
              onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Descrição"
              required
              value={courseForm.description}
              onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creating === "course"}
              className="col-span-2 rounded-md bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              Criar curso
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-medium text-slate-900 mb-3">Novo módulo</h2>
          <form onSubmit={handleCreateModule} className="grid grid-cols-2 gap-3">
            <select
              required
              value={moduleForm.courseId}
              onChange={(e) => setModuleForm({ ...moduleForm, courseId: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm col-span-2"
            >
              <option value="">Curso...</option>
              {languages.flatMap((l) =>
                l.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {l.name} · {c.title}
                  </option>
                ))
              )}
            </select>
            <input
              placeholder="slug"
              required
              value={moduleForm.slug}
              onChange={(e) => setModuleForm({ ...moduleForm, slug: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Título"
              required
              value={moduleForm.title}
              onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Descrição"
              required
              value={moduleForm.description}
              onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm col-span-2"
            />
            <button
              type="submit"
              disabled={creating === "module"}
              className="col-span-2 rounded-md bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              Criar módulo
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
