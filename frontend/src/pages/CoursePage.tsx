import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCourse, Course } from "../lib/api";

export default function CoursePage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!courseId) return;
    getCourse(courseId)
      .then(setCourse)
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar curso."));
  }, [courseId]);

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }

  if (!course) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-sm text-slate-500 hover:text-slate-800">
            ← Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-sm font-medium text-indigo-600 mb-1">{course.language.name}</p>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">{course.title}</h1>
        <p className="text-slate-500 mb-8">{course.description}</p>

        <div className="space-y-3">
          {course.modules.map((mod) => (
            <Link
              key={mod.id}
              to={`/modules/${mod.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition"
            >
              <h2 className="font-medium text-slate-900">{mod.title}</h2>
              <p className="text-sm text-slate-500">{mod.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
