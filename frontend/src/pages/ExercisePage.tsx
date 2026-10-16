import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getExercise, submitExercise, ExerciseDetail, SubmitResult } from "../lib/api";

export default function ExercisePage() {
  const { exerciseId } = useParams();
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!exerciseId) return;
    getExercise(exerciseId)
      .then((data) => {
        setExercise(data);
        setResult(null);
        setAnswer("");
        setSelectedOption(null);
        setShowHint(false);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar exercício."));
  }, [exerciseId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!exercise) return;

    const value = exercise.type === "MULTIPLE_CHOICE" ? selectedOption : answer;
    if (!value) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await submitExercise(exercise.id, value);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar resposta.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !exercise) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }

  if (!exercise) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate(`/modules/${exercise.moduleId}`)}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ← Voltar ao módulo
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-slate-900 font-medium mb-4">{exercise.prompt}</p>

          {exercise.starterCode && (
            <pre className="bg-slate-900 text-slate-100 text-sm rounded-lg p-4 mb-4 overflow-x-auto">
              {exercise.starterCode}
            </pre>
          )}

          <form onSubmit={handleSubmit}>
            {exercise.type === "MULTIPLE_CHOICE" && exercise.options && (
              <div className="space-y-2 mb-4">
                {exercise.options.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition ${
                      selectedOption === opt.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="option"
                      value={opt.id}
                      checked={selectedOption === opt.id}
                      onChange={() => setSelectedOption(opt.id)}
                      className="accent-indigo-600"
                    />
                    <span className="text-sm text-slate-800">{opt.text}</span>
                  </label>
                ))}
              </div>
            )}

            {exercise.type === "OUTPUT_PREDICTION" && (
              <input
                type="text"
                placeholder="Qual é a saída?"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full mb-4 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting ? "Enviando..." : "Enviar resposta"}
              </button>

              {exercise.hint && !result?.isCorrect && (
                <button
                  type="button"
                  onClick={() => setShowHint(true)}
                  className="text-sm text-slate-500 hover:text-slate-800"
                >
                  Ver dica
                </button>
              )}
            </div>
          </form>

          {showHint && exercise.hint && !result?.isCorrect && (
            <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              💡 {exercise.hint}
            </p>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {result && (
            <div
              className={`mt-4 rounded-md px-3 py-3 text-sm ${
                result.isCorrect
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-amber-50 border border-amber-200 text-amber-800"
              }`}
            >
              <p className="font-medium">{result.isCorrect ? "✅ Correto!" : "Ainda não é isso."}</p>
              <p className="mt-1">{result.feedback.message}</p>
              {result.explanation && <p className="mt-2 text-slate-600">{result.explanation}</p>}
              <p className="mt-2 text-xs text-slate-400">Tentativas: {result.attempts}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
