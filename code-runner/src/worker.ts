import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { ensureImages, runInSandbox } from "./lib/sandbox";

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

interface ExecuteJobData {
  executionId: string;
}

async function processJob(job: Job<ExecuteJobData>) {
  const { executionId } = job.data;

  const execution = await prisma.codeExecution.findUnique({ where: { id: executionId } });
  if (!execution) {
    // eslint-disable-next-line no-console
    console.error(`CodeExecution ${executionId} não encontrada — job descartado.`);
    return;
  }

  await prisma.codeExecution.update({
    where: { id: executionId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const result = await runInSandbox(execution.language, execution.code, execution.stdin ?? undefined);

  const status = result.timedOut
    ? "TIMEOUT"
    : result.errorMessage && result.exitCode === null
      ? "FAILED"
      : "COMPLETED";

  // O Postgres rejeita o caractere NUL em colunas de texto; um programa pode imprimi-lo.
  const clean = (value: string) => value.replace(/\u0000/g, "");

  await prisma.codeExecution.update({
    where: { id: executionId },
    data: {
      status,
      stdout: clean(result.stdout),
      stderr: clean(result.stderr),
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      errorMessage: result.errorMessage,
      finishedAt: new Date(),
    },
  });
}

async function main() {
  // Só começa a consumir a fila depois das imagens estarem prontas, senão o
  // primeiro job gastaria o tempo limite inteiro baixando a imagem.
  await ensureImages();

  const worker = new Worker<ExecuteJobData>("code-execution", processJob, {
    connection,
    concurrency: 4, // nº de containers rodando em paralelo neste worker — ajuste conforme os recursos do host
  });

  worker.on("completed", (job) => {
    // eslint-disable-next-line no-console
    console.log(`Execução ${job.data.executionId} concluída.`);
  });

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`Execução ${job?.data.executionId} falhou:`, err);
    if (job) {
      prisma.codeExecution
        .update({
          where: { id: job.data.executionId },
          data: { status: "FAILED", errorMessage: err.message, finishedAt: new Date() },
        })
        .catch(() => {
          /* melhor esforço — se nem isso funcionar, o registro fica QUEUED/RUNNING e será visível como travado */
        });
    }
  });

  // eslint-disable-next-line no-console
  console.log("code-runner worker iniciado, aguardando jobs na fila 'code-execution'...");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Falha ao iniciar o code-runner:", err);
  process.exit(1);
});
