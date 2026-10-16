import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { executeCode, getCodeExecution, CodeExecution } from "../lib/api";

const DEFAULT_CODE = 'print("Olá, CodeLearn!")\n';

export default function PlaygroundPage() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [stdin, setStdin] = useState("");
  const [execution, setExecution] = useState<CodeExecution | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  // Para o polling ao sair da página (senão o intervalo continuaria rodando).
  useEffect(() => () => stopPolling(), []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function handleRun() {
    stopPolling();
    setError(null);
    setExecution(null);
    setRunning(true);

    try {
      const { executionId } = await executeCode("PYTHON", code, stdin || undefined);

      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        if (attempts > 40) {
          // ~32s sem resposta: o code-runner provavelmente está fora do ar.
          stopPolling();
          setRunning(false);
          setError("A execução está demorando demais. Verifique se o serviço code-runner está rodando.");
          return;
        }
        try {
          const result = await getCodeExecution(executionId);
          setExecution(result);
          if (result.status === "COMPLETED" || result.status === "FAILED" || result.status === "TIMEOUT") {
            stopPolling();
            setRunning(false);
          }
        } catch (err) {
          stopPolling();
          setRunning(false);
          setError(err instanceof Error ? err.message : "Erro ao consultar execução.");
        }
      }, 800);
    } catch (err) {
      setRunning(false);
      setError(err instanceof Error ? err.message : "Erro ao executar código.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/dashboard")} className="text-sm text-slate-500 hover:text-slate-800">
            ← Dashboard
          </button>
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full px-2 py-1">
            Python · sandbox isolado
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Playground</h1>
        <p className="text-slate-500 mb-6">
          Roda de verdade num container Docker isolado, sem rede e com limites de tempo, memória e processos.
        </p>

        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Código</label>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={10}
            spellCheck={false}
            className="w-full font-mono text-sm bg-slate-900 text-slate-100 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
            Entrada padrão (stdin) — opcional
          </label>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={2}
            className="w-full font-mono text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="rounded-md bg-indigo-600 text-white px-5 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
        >
          {running ? "Executando..." : "Executar"}
        </button>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {execution && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Resultado</span>
              <span
                className={`text-xs font-medium rounded-full px-2 py-1 ${
                  execution.status === "COMPLETED"
                    ? "bg-green-50 text-green-700"
                    : execution.status === "FAILED" || execution.status === "TIMEOUT"
                      ? "bg-red-50 text-red-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {execution.status}
              </span>
            </div>

            {execution.stdout && (
              <>
                <p className="text-xs text-slate-400 mb-1">stdout</p>
                <pre className="bg-slate-900 text-slate-100 text-sm rounded-lg p-3 mb-3 overflow-x-auto whitespace-pre-wrap">
                  {execution.stdout}
                </pre>
              </>
            )}

            {execution.stderr && (
              <>
                <p className="text-xs text-slate-400 mb-1">stderr</p>
                <pre className="bg-red-950 text-red-200 text-sm rounded-lg p-3 mb-3 overflow-x-auto whitespace-pre-wrap">
                  {execution.stderr}
                </pre>
              </>
            )}

            {execution.errorMessage && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
                {execution.errorMessage}
              </p>
            )}

            {execution.exitCode !== null && (
              <p className="text-xs text-slate-400">Código de saída: {execution.exitCode}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
