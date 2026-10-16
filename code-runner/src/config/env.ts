import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    // eslint-disable-next-line no-console
    console.error(`Variável de ambiente obrigatória ausente: ${name}`);
    process.exit(1);
  }
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",

  // Limites do sandbox (item 5 da spec: CPU, memória, tempo, processos, output).
  EXECUTION_TIMEOUT_MS: Number(process.env.EXECUTION_TIMEOUT_MS ?? 5000),
  MEMORY_LIMIT: process.env.MEMORY_LIMIT ?? "128m",
  CPU_LIMIT: process.env.CPU_LIMIT ?? "0.5",
  PIDS_LIMIT: process.env.PIDS_LIMIT ?? "64",
  MAX_OUTPUT_CHARS: Number(process.env.MAX_OUTPUT_CHARS ?? 20000),
};
