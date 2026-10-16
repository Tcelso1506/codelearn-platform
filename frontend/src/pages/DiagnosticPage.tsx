import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listLanguages,
  startAssessment,
  answerAssessment,
  finishAssessment,
  DiagnosticQuestion,
  DiagnosticResult,
  Language,
} from "../lib/api";

type ViewState =
  | { phase: "loading" }
  | { phase: "choose"; languages: Language[] }
  | { phase: "question"; data: DiagnosticQuestion; lastFeedback?: string }
  | { phase: "finishing" }
  | { phase: "result"; data: DiagnosticResult }
  | { phase: "error"; message: string };

export default function DiagnosticPage() {
  const [state, setState] = useState<ViewState>({ phase: "loading" });
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function startFor(languageId: string) {
    setState({ phase: "loading" });
    try {
      const started = await startAssessment(languageId);
      if (started.status === "ready_to_finish") {
        // Diagnóstico retomado já no fim: só falta calcular o resultado.
        setState({ phase: "finishing" });
        const finalResult = await finishAssessment(started.attemptId);
        setState({ phase: "result", data: finalResult });
        return;
      }
      setState({ phase: "question", data: started });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : "Erro ao iniciar diagnóstico." });
    }
  }

  useEffect(() => {
    async function begin() {
      try {
        const languages = await listLanguages();
        if (languages.length === 0) {
          setState({ phase: "error", message: "Nenhuma linguagem disponível para diagnóstico ainda." });
          return;
        }
        // Com uma única linguagem não há o que escolher: começa direto.
        if (languages.length === 1) {
          await startFor(languages[0].id);
          return;
        }
        setState({ phase: "choose", languages });
      } catch (err) {
        setState({ phase: "error", message: err instanceof Error ? err.message : "Erro ao iniciar diagnóstico." });
      }
    }
    begin();
  }, []);

  async function handleSubmit() {
    if (state.phase !== "question") return;
    const value = state.data.question.type === "MULTIPLE_CHOICE" ? selectedOption : answer;
    if (!value) return;

    setSubmitting(true);
    try {
      const result = await answerAssessment(state.data.attemptId, state.data.question.id, value);
      setAnswer("");
      setSelectedOption(null);

      if (result.status === "ready_to_finish") {
        setState({ phase: "finishing" });
        const finalResult = await finishAssessment(state.data.attemptId);
        setState({ phase: "result", data: finalResult });
        return;
      }

      setState({
        phase: "question",
        data: {
          attemptId: state.data.attemptId,
          status: "in_progress",
          skill: result.skill!,
          progress: result.progress!,
          question: result.question!,
        },
        lastFeedback: result.wasCorrect ? "Correto!" : "Não foi dessa vez.",
      });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : "Erro ao enviar resposta." });
    } finally {
      setSubmitting(false);
    }
  }

  if (state.phase === "loading" || state.phase === "finishing") {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        {state.phase === "finishing" ? "Calculando seu resultado..." : "Preparando diagnóstico..."}
      </div>
    );
  }

  if (state.phase === "choose") {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-2xl mx-auto px-6 py-12">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Qual diagnóstico você quer fazer?</h1>
          <p className="text-sm text-slate-500 mb-6">Escolha a linguagem para descobrir seu nível e por onde começar.</p>
          <div className="space-y-3">
            {state.languages.map((l) => (
              <button
                key={l.id}
                onClick={() => startFor(l.id)}
                className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-500 transition"
              >
                <p className="font-medium text-slate-900">{l.name}</p>
                <p className="text-sm text-slate-500">{l.description}</p>
              </button>
            ))}
          </div>
          <button onClick={() => navigate("/dashboard")} className="mt-6 text-sm text-slate-500 underline">
            Voltar ao dashboard
          </button>
        </main>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-red-600">
        <p>{state.message}</p>
        <button onClick={() => navigate("/dashboard")} className="text-sm text-slate-500 underline">
          Voltar ao dashboard
        </button>
      </div>
    );
  }

  if (state.phase === "result") {
    const { data } = state;
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-2xl mx-auto px-6 py-12">
          <p className="text-sm font-medium text-indigo-600 mb-1">Diagnóstico concluído</p>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">Nível: {data.level}</h1>
          {data.stoppedEarly && (
            <p className="text-sm text-slate-500 mb-6">
              O diagnóstico foi encerrado mais cedo porque havia bastante espaço para reforçar os
              fundamentos antes de avançar.
            </p>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">Competências</h2>
            <div className="space-y-3">
              {data.skills.map((s) => (
                <div key={s.name}>
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
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800 mb-2">Pontos fortes</p>
              {data.strengths.length === 0 ? (
                <p className="text-sm text-green-700">Nenhum ainda — vamos construir juntos.</p>
              ) : (
                <ul className="text-sm text-green-700 list-disc pl-4">
                  {data.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800 mb-2">Lacunas</p>
              {data.gaps.length === 0 ? (
                <p className="text-sm text-amber-700">Nenhuma lacuna clara identificada.</p>
              ) : (
                <ul className="text-sm text-amber-700 list-disc pl-4">
                  {data.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {data.recommendation ? (
            <button
              onClick={() => navigate(`/modules/${data.recommendation!.moduleId}`)}
              className="w-full rounded-md bg-indigo-600 text-white py-3 text-sm font-medium hover:bg-indigo-700"
            >
              Começar por: {data.recommendation.moduleTitle}
            </button>
          ) : (
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full rounded-md bg-indigo-600 text-white py-3 text-sm font-medium hover:bg-indigo-700"
            >
              Ir para o dashboard
            </button>
          )}
        </main>
      </div>
    );
  }

  const { data, lastFeedback } = state;
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Competência {data.progress.currentSkillIndex + 1} de {data.progress.totalSkills}
          </span>
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full px-2 py-1">
            {data.skill.name}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {lastFeedback && <p className="text-sm text-slate-400 mb-3">{lastFeedback}</p>}

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-slate-900 font-medium mb-4 whitespace-pre-wrap">{data.question.prompt}</p>

          {data.question.starterCode && (
            <pre className="bg-slate-900 text-slate-100 text-sm rounded-lg p-4 mb-4 overflow-x-auto whitespace-pre-wrap">
              {data.question.starterCode}
            </pre>
          )}

          {data.question.type === "MULTIPLE_CHOICE" && data.question.options && (
            <div className="space-y-2 mb-4">
              {data.question.options.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition ${
                    selectedOption === opt.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300"
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

          {data.question.type === "OUTPUT_PREDICTION" && (
            <input
              type="text"
              placeholder="Qual é a saída?"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full mb-4 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "Enviando..." : "Responder"}
          </button>
        </div>
      </main>
    </div>
  );
}
