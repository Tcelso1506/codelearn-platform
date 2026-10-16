import { spawn, execFile } from "node:child_process";
import crypto from "node:crypto";
import { env } from "../config/env";

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  errorMessage?: string;
}

interface LanguageConfig {
  image: string;
  /** Comando executado dentro do container. O código chega na variável de ambiente CODE. */
  command: string[];
}

// Só Python está implementado de verdade nesta fase (spec item 6). Adicionar
// uma linguagem é adicionar uma entrada aqui + a imagem Docker correspondente.
//
// O código do usuário NÃO é passado por bind mount (-v): com o worker rodando
// dentro de um container (Docker-fora-do-Docker), um caminho local do worker não
// existe no host, que é quem resolve o mount. Em vez disso o código vai numa
// variável de ambiente e é gravado no /tmp (tmpfs) do próprio container efêmero.
const LANGUAGE_CONFIG: Record<string, LanguageConfig> = {
  PYTHON: {
    image: "python:3.12-alpine",
    command: ["sh", "-c", `printf '%s' "$CODE" > /tmp/main.py && exec python /tmp/main.py`],
  },
};

export const SANDBOX_IMAGES = Object.values(LANGUAGE_CONFIG).map((c) => c.image);

/**
 * Baixa as imagens de execução antecipadamente. Sem isso, o primeiro `docker run`
 * gastaria o tempo limite inteiro baixando a imagem e falharia por timeout.
 */
export async function ensureImages(): Promise<void> {
  for (const image of SANDBOX_IMAGES) {
    await new Promise<void>((resolve) => {
      execFile("docker", ["pull", image], (err, _stdout, stderr) => {
        if (err) {
          // eslint-disable-next-line no-console
          console.error(`Não foi possível baixar ${image} (segue usando a cópia local, se houver): ${stderr || err.message}`);
        } else {
          // eslint-disable-next-line no-console
          console.log(`Imagem de sandbox pronta: ${image}`);
        }
        resolve();
      });
    });
  }
}

/**
 * Executa código de usuário dentro de um container Docker efêmero e isolado:
 *  - sem rede (--network none)
 *  - sistema de arquivos somente leitura, exceto um /tmp minúsculo em tmpfs (noexec)
 *  - CPU, memória e nº de processos limitados
 *  - sem privilégios extras, todas as capabilities removidas, usuário não-root
 *  - kill explícito por nome do container ao estourar tempo ou limite de saída
 *    (matar só o processo cliente `docker` não garante que o container pare).
 */
export async function runInSandbox(language: string, code: string, stdin?: string): Promise<SandboxResult> {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    return {
      stdout: "",
      stderr: "",
      exitCode: null,
      timedOut: false,
      errorMessage: `Linguagem sem imagem de sandbox configurada: ${language}`,
    };
  }

  const containerName = `exec-${crypto.randomUUID()}`;

  const dockerArgs = [
    "run",
    "--rm",
    "--name",
    containerName,
    "--network",
    "none",
    "--memory",
    env.MEMORY_LIMIT,
    "--memory-swap",
    env.MEMORY_LIMIT, // impede uso de swap além do limite de memória
    "--cpus",
    env.CPU_LIMIT,
    "--pids-limit",
    env.PIDS_LIMIT,
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=16m,mode=1777",
    "--security-opt",
    "no-new-privileges",
    "--cap-drop",
    "ALL",
    "--user",
    "1000:1000",
    "-e",
    `CODE=${code}`,
    "-e",
    "PYTHONDONTWRITEBYTECODE=1",
    "-e",
    "PYTHONUNBUFFERED=1",
    "--workdir",
    "/tmp",
    "-i",
    config.image,
    ...config.command,
  ];

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let outputLimitExceeded = false;

    function killContainer() {
      execFile("docker", ["kill", containerName], () => {
        /* ignora erro — o container pode já ter terminado sozinho */
      });
    }

    function append(current: string, chunk: string, truncated: boolean): { value: string; truncated: boolean } {
      if (truncated) return { value: current, truncated };
      const next = current + chunk;
      if (next.length > env.MAX_OUTPUT_CHARS) {
        return { value: next.slice(0, env.MAX_OUTPUT_CHARS) + "\n... [saída truncada: limite de output excedido]", truncated: true };
      }
      return { value: next, truncated: false };
    }

    const child = spawn("docker", dockerArgs);

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      killContainer();
    }, env.EXECUTION_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      const r = append(stdout, chunk.toString("utf-8"), stdoutTruncated);
      stdout = r.value;
      if (r.truncated && !stdoutTruncated) {
        stdoutTruncated = true;
        outputLimitExceeded = true;
        killContainer(); // um programa que só imprime não deve rodar até o timeout
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const r = append(stderr, chunk.toString("utf-8"), stderrTruncated);
      stderr = r.value;
      if (r.truncated && !stderrTruncated) {
        stderrTruncated = true;
        outputLimitExceeded = true;
        killContainer();
      }
    });

    // Um programa que não lê o stdin fecha o pipe; sem esse handler, o EPIPE derrubaria o worker.
    child.stdin.on("error", () => {});
    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();

    child.on("error", (err) => {
      clearTimeout(timeoutHandle);
      resolve({
        stdout,
        stderr,
        exitCode: null,
        timedOut: false,
        errorMessage: `Falha ao iniciar o sandbox (Docker disponível no host?): ${err.message}`,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeoutHandle);
      resolve({
        stdout,
        stderr,
        exitCode: code,
        timedOut,
        errorMessage: timedOut
          ? "Tempo limite de execução excedido."
          : outputLimitExceeded
            ? "Limite de saída excedido: a execução foi interrompida."
            : undefined,
      });
    });
  });
}
