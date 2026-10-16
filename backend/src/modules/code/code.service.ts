import { prisma } from "../../lib/prisma";
import { codeExecutionQueue } from "../../lib/queue";
import { HttpError } from "../../middleware/errorHandler";

const MAX_CODE_LENGTH = 20_000; // proteção simples contra payloads absurdos antes mesmo de chegar ao runner
const MAX_STDIN_LENGTH = 5_000;
const MAX_ACTIVE_PER_USER = 3; // execuções na fila/rodando ao mesmo tempo, por usuário
const ACTIVE_WINDOW_MS = 2 * 60 * 1000; // ignora jobs "presos" (ex.: worker fora do ar)
const SUPPORTED_LANGUAGES = ["PYTHON"] as const;

export async function requestExecution(userId: string, language: string, code: string, stdin?: string) {
  if (!SUPPORTED_LANGUAGES.includes(language as (typeof SUPPORTED_LANGUAGES)[number])) {
    throw new HttpError(
      400,
      `Linguagem "${language}" ainda não suportada pelo code-runner. Suportadas: ${SUPPORTED_LANGUAGES.join(", ")}.`
    );
  }

  if (code.length === 0 || code.length > MAX_CODE_LENGTH) {
    throw new HttpError(400, `Código deve ter entre 1 e ${MAX_CODE_LENGTH} caracteres.`);
  }

  // Caractere NUL não é aceito pelo Postgres nem passa por variáveis de ambiente.
  if (code.includes("\u0000") || (stdin ?? "").includes("\u0000")) {
    throw new HttpError(400, "O código e a entrada não podem conter caracteres nulos.");
  }
  if ((stdin ?? "").length > MAX_STDIN_LENGTH) {
    throw new HttpError(400, `A entrada padrão deve ter no máximo ${MAX_STDIN_LENGTH} caracteres.`);
  }

  const active = await prisma.codeExecution.count({
    where: {
      userId,
      status: { in: ["QUEUED", "RUNNING"] },
      createdAt: { gte: new Date(Date.now() - ACTIVE_WINDOW_MS) },
    },
  });
  if (active >= MAX_ACTIVE_PER_USER) {
    throw new HttpError(429, "Você já tem execuções em andamento. Aguarde terminarem antes de enviar outra.");
  }

  const execution = await prisma.codeExecution.create({
    data: {
      userId,
      language: language as (typeof SUPPORTED_LANGUAGES)[number],
      code,
      stdin: stdin ?? null,
      status: "QUEUED",
    },
  });

  try {
    await codeExecutionQueue.add("execute", { executionId: execution.id }, { jobId: execution.id });
  } catch {
    // Fila indisponível (ex.: Redis fora do ar): não deixa o registro preso em QUEUED.
    await prisma.codeExecution.update({
      where: { id: execution.id },
      data: { status: "FAILED", errorMessage: "Fila de execução indisponível.", finishedAt: new Date() },
    });
    throw new HttpError(503, "Serviço de execução temporariamente indisponível. Tente novamente em instantes.");
  }

  return { executionId: execution.id, status: execution.status };
}

export async function getExecution(userId: string, executionId: string) {
  const execution = await prisma.codeExecution.findUnique({ where: { id: executionId } });

  if (!execution || execution.userId !== userId) {
    throw new HttpError(404, "Execução não encontrada.");
  }

  return {
    id: execution.id,
    status: execution.status,
    stdout: execution.stdout,
    stderr: execution.stderr,
    exitCode: execution.exitCode,
    timedOut: execution.timedOut,
    errorMessage: execution.errorMessage,
    createdAt: execution.createdAt,
    startedAt: execution.startedAt,
    finishedAt: execution.finishedAt,
  };
}
