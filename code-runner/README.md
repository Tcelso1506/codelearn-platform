# code-runner (Fase 4)

Worker separado do backend principal. Consome jobs da fila `code-execution`
(BullMQ/Redis), executa o código do usuário dentro de um **container Docker
efêmero e isolado**, e grava o resultado de volta na tabela `code_executions`
(mesmo Postgres do backend — ver `prisma/schema.prisma` desta pasta para por
que ele tem seu próprio schema, restrito a essa única tabela).

## Fluxo

```
backend (POST /code/execute)
   → cria CodeExecution (status QUEUED)
   → enfileira job { executionId } no BullMQ
                                          code-runner (este serviço)
                                             → pega o job
                                             → status RUNNING
                                             → docker run <imagem> (isolado)
                                             → captura stdout/stderr/exit code
                                             → status COMPLETED/FAILED/TIMEOUT
backend (GET /code/execute/:id) ← lê o resultado gravado
```

## Limites aplicados em cada execução (spec item 5)

| Limite | Como é aplicado |
|---|---|
| CPU | `--cpus` (padrão 0.5) |
| Memória | `--memory` + `--memory-swap` iguais (sem estouro pra swap) |
| Processos | `--pids-limit` (padrão 64) — evita fork bomb |
| Rede | `--network none` — sem acesso à rede, nem à rede interna do Compose |
| Sistema de arquivos | `--read-only`; só `/tmp` é gravável — um `tmpfs` de 16 MB, `noexec`, que some com o container |
| Privilégios | `--cap-drop ALL`, `--security-opt no-new-privileges`, `--user 1000:1000` (nunca roda como root) |
| Tempo | timeout no Node (`EXECUTION_TIMEOUT_MS`, padrão 5s) que mata o container por nome (`docker kill`) |
| Tamanho do output | truncado ao ultrapassar `MAX_OUTPUT_CHARS` (padrão 20.000 caracteres) e o container é interrompido, para não rodar até o timeout só imprimindo |
| Destruição do container | `--rm` — o container nunca sobrevive à execução, sucesso ou falha |

## Como o código do usuário chega ao container

O código **não** é passado por bind mount (`-v`): com o worker dentro de um container
(Docker-fora-do-Docker), quem resolve o mount é o daemon do *host*, onde o caminho
temporário do worker não existe. Em vez disso o código vai na variável de ambiente
`CODE` e o container o grava em `/tmp/main.py` (tmpfs) antes de executar. Também por
isso o worker baixa a imagem (`docker pull`) ao iniciar, antes de consumir a fila — senão o
primeiro job gastaria o tempo limite inteiro no download.

## Decisão de arquitetura: Docker-fora-do-Docker (DooD), não Docker-dentro-do-Docker

Este worker roda dentro de um container que **monta o socket do Docker do
host** (`/var/run/docker.sock`) para pedir ao daemon do host que suba os
containers de execução — em vez de rodar um daemon Docker aninhado dentro
deste container (Docker-in-Docker, mais pesado e com seus próprios problemas
de segurança).

**Isso é uma escolha pragmática para a Fase 4, não a arquitetura final de
produção**, e é importante ser honesto sobre o trade-off: montar o socket do
Docker dá a este container, na prática, controle equivalente a root sobre o
host — se o próprio worker for comprometido, ele pode escapar para o host.
O isolamento real está inteiramente na segurança do container do *código do
usuário* (a tabela acima), não na do worker em si.

Para produção, o caminho recomendado (documentado aqui, não implementado
nesta fase para não fingir uma sofisticação que exigiria infraestrutura que
este ambiente de desenvolvimento não tem) seria substituir `docker run` por
um runtime de isolamento mais forte no nível do próprio container de
execução — por exemplo `gVisor` (`--runtime=runsc`) ou microVMs `Firecracker`
— e rodar o worker sem acesso direto ao socket do host, através de uma API de
execução dedicada (o padrão usado por serviços como Judge0/Piston).

## Variáveis de ambiente

Ver `.env.example` na raiz do projeto — este serviço usa `DATABASE_URL`,
`REDIS_URL`, e os limites (`EXECUTION_TIMEOUT_MS`, `MEMORY_LIMIT`,
`CPU_LIMIT`, `PIDS_LIMIT`, `MAX_OUTPUT_CHARS`).

## Linguagens suportadas

Só **Python** (`python:3.12-alpine`) nesta fase, conforme a priorização da
spec. Adicionar uma nova linguagem é adicionar uma entrada em
`LANGUAGE_CONFIG` (`src/lib/sandbox.ts`) com a imagem Docker e o comando de
execução — o resto do pipeline (fila, limites, captura de output, timeout)
já é genérico e não muda.

## Rodando localmente (fora do Docker Compose)

Requer Docker instalado no host (o CLI chama `docker run` diretamente,
sem precisar do socket montado, já que roda direto na máquina):

```bash
cd code-runner
npm install
npx prisma generate
npm run dev
```

## Nota de transparência

Este serviço ainda não foi executado contra um daemon Docker real (o ambiente onde o
código foi escrito não tem Docker). O que foi verificado: compilação, e o transporte do
código por variável de ambiente + `printf` (com aspas, quebras de linha, `%`, `$` e
crases). Os limites de recurso são flags padrão do `docker run`, mas rode `docker compose up`
e teste (loop infinito, uso de memória, `while True: print()`, fork bomb) antes de expor
isto a usuários reais.
