# Arquitetura — CodeLearn Platform

## Visão geral (estado atual, a partir da Fase 4)

```
                        ┌────────────┐
                        │  Frontend  │  React + Vite
                        └─────┬──────┘
                              │ HTTPS/REST
                        ┌─────▼──────┐
                        │   Backend   │  Node/TS API (Express)
                        └───┬───┬────┘
              ┌─────────────┘   └─────────────┐
        ┌─────▼─────┐                   ┌──────▼──────┐
        │ PostgreSQL │                   │    Redis     │
        │ (Prisma)   │                   │  (fila BullMQ)│
        └────────────┘                   └──────┬──────┘
                                                 │ jobs
                                          ┌──────▼───────┐
                                          │ code-runner   │  worker separado
                                          │ (BullMQ)      │
                                          └──────┬───────┘
                                                 │ docker run
                                          ┌──────▼───────┐
                                          │ Container     │  efêmero, isolado,
                                          │ de execução   │  destruído após uso
                                          └──────────────┘
```

Este diagrama já é a arquitetura real (não só planejada): a partir da Fase 4,
Frontend, Backend, PostgreSQL, Redis e `code-runner` estão todos implementados
e conectados.

## Decisões técnicas e justificativa

1. **Express em vez de NestJS/Fastify (Fase 1):** o domínio da Fase 1 era pequeno
   (auth + perfil). NestJS adiciona uma camada de DI/decorators que só compensa
   quando há muitos módulos interdependentes — e mesmo agora, com diagnóstico,
   exercícios e code-runner, a organização em `services`/`controllers` por
   módulo continua dando conta sem essa camada extra.
2. **JWT de acesso curto + refresh token opaco em banco:** um JWT sozinho não pode
   ser revogado antes de expirar. Guardando o refresh token (hash) em uma tabela,
   conseguimos: (a) revogar sessões individualmente, (b) detectar reuso de token
   roubado, (c) manter o access token de vida curta (15 min) para reduzir a janela
   de risco caso vaze.
3. **Prisma:** migrations versionadas e schema único como fonte de verdade — o
   schema do backend é a fonte da verdade física; `code-runner` tem seu próprio
   schema restrito (ver Fase 4 abaixo), mas nunca roda migrations.

## Schema da Fase 1

```
User
 ├── id, email (único), passwordHash, name
 ├── createdAt, updatedAt
 └── refreshTokens: RefreshToken[]

RefreshToken
 ├── id, tokenHash (único), userId → User
 ├── expiresAt, revokedAt (nullable)
 └── createdAt
```

## Segurança já implementada na Fase 1

- Hash de senha com bcrypt (custo 12).
- Hash do refresh token antes de persistir (nunca guardamos o token em claro).
- CORS restrito à origem do frontend (via `FRONTEND_URL` no `.env`).
- Rate limiting básico no `/auth/login` e `/auth/register` (proteção contra brute force).
- Validação de payload com Zod em todas as rotas.
- Erros padronizados, sem vazar detalhes internos (stack trace) em produção.
- Nenhum secret no código — tudo lido de variáveis de ambiente (`.env`, nunca commitado).

## Schema da Fase 2 (adicionado ao mesmo `schema.prisma`)

```
Language ─┬─ Course ─┬─ Module ─┬─ Lesson
          │          │          └─ Exercise
          │          └─ (minMasteryPercent, minExercises por Module)
          └─ (slug único)

UserExerciseProgress (userId, exerciseId) → solved, attempts, lastAnswer
```

### Decisões da Fase 2

1. **Tipos de exercício sem execução real de código nesta fase:** `MULTIPLE_CHOICE`
   e `OUTPUT_PREDICTION` (previsão de saída, comparada como texto). Um tipo
   `programação livre` exigiria o code-runner (Fase 4) para ser corrigido com
   segurança — implementá-lo antes disso resultaria em "simular execução de código
   sem deixar isso explícito", que a spec proíbe explicitamente (item 33).
2. **Mastery calculada sob demanda, não armazenada:** `masteryPercent` de um módulo
   é `exercícios resolvidos / total de exercícios`, calculado a cada request de
   `/progress`. Evita manter um contador redundante que poderia dessincronizar do
   estado real (`UserExerciseProgress`).
3. **Conteúdo como dado, não como componente:** `Lesson.content` é Markdown puro
   guardado no banco; a UI apenas renderiza. Isso é o que permite o futuro painel
   administrativo (Fase 7) editar conteúdo sem deploy de frontend.
4. **Feedback em camadas, mas simplificado:** o "possível motivo do erro" citado
   no item 12 da spec ainda é genérico (hint → explicação) nesta fase, porque a
   análise semântica real de erro depende de rodar o código do usuário e comparar
   com o esperado — isso só é seguro com o code-runner isolado (Fase 4).

## Schema e algoritmo da Fase 3

```
Skill (tier 1/2/3, ordem dentro do tier)
  ├── AssessmentQuestion (order 1 = triagem, order 2 = aprofundamento)
  └── UserSkill (mastery persistida por usuário, após cada diagnóstico)

AssessmentAttempt (cursor: skill atual + qual pergunta da skill)
  └── AssessmentAnswer (uma por pergunta respondida na tentativa)
```

### Como o diagnóstico é realmente adaptativo

1. As competências (`Skill`) são ordenadas em **tiers**: 1 = fundamentos
   (sintaxe, lógica), 2 = intermediário (controle de fluxo, funções), 3 =
   avançado (estruturas de dados, debugging).
2. Para cada competência, a **pergunta 1 é a triagem**. Acertou → o sistema
   assume domínio e pula direto para a próxima competência. Errou → aplica a
   **pergunta 2, mais profunda**, da mesma competência antes de seguir — é aqui
   que o diagnóstico "aprofunda" onde o usuário mostrou dificuldade (item 8).
3. Ao terminar todas as competências de um tier, o sistema calcula a taxa de
   acerto do tier inteiro. Se menos de 50% das competências foram "passadas"
   (≥50% de acerto), o diagnóstico **para ali** em vez de aplicar tiers mais
   avançados que quase certamente só confirmariam lacunas já visíveis.
4. Ao finalizar: `masteryPercent` por competência, classificação em pontos
   fortes (≥70%) e lacunas (<50%), nível geral (Iniciante/Intermediário/
   Avançado conforme os tiers "passados"), persistido em `UserSkill`.
5. **Recomendação de trilha honesta:** como o catálogo de conteúdo (Fase 2)
   ainda tem um módulo por linguagem, a recomendação final aponta para o
   próximo módulo real e incompleto (reaproveita `progress.service`) — nunca
   inventa uma trilha multi-módulo que o catálogo ainda não tem.
6. **Resumível:** `POST /assessments/start` é idempotente — se já existe uma
   tentativa `IN_PROGRESS`, devolve a pergunta atual em vez de recomeçar.

## Schema e fluxo da Fase 4

```
CodeExecution (status: QUEUED → RUNNING → COMPLETED | FAILED | TIMEOUT)
```

`POST /code/execute` cria o registro, enfileira `{ executionId }` no BullMQ e
responde `202` imediatamente — o cliente faz polling em `GET /code/execute/:id`
até o status sair de `RUNNING`. Ver `code-runner/README.md` para a tabela
completa de limites aplicados a cada execução (CPU, memória, processos, rede,
filesystem, tempo, tamanho do output) e para a discussão honesta do trade-off
de segurança da abordagem Docker-fora-do-Docker usada nesta fase (o worker tem
acesso ao socket do Docker do host — aceitável para desenvolvimento, não para
produção sem substituir por gVisor/Firecracker, como documentado lá).

### Por que `code-runner` tem seu próprio `schema.prisma`

Em vez de compartilhar o client Prisma do backend (o que exigiria configurar
workspaces npm reais, complexidade desproporcional para uma única tabela),
`code-runner` tem um schema próprio que só modela `CodeExecution` — a única
tabela que ele lê e escreve. As migrations continuam sendo responsabilidade
exclusiva do backend; o `code-runner` nunca roda `prisma migrate`, só
`prisma generate`. Isso é um limite de acesso deliberado (o worker de
execução de código não tem nenhuma razão para enxergar `User`, `Exercise`
etc.), não um atalho.

## Schema e decisões da Fase 5

```
Project (level: BEGINNER/INTERMEDIATE/ADVANCED, por Language)
  └── ProjectProgress (userId, projectId) → status, repoUrl
```

- **Conteúdo do projeto como dado estruturado** (objective, problem, stack,
  requirements, features, successCriteria, suggestedStructure,
  suggestedReadme, futureImprovements) — os campos de lista são `Json` de
  strings, mesmo padrão já usado em `Exercise.options`.
- **GitHub "preparado", não implementado** (item 16 da spec): em vez de criar
  uma tabela `GitHubIntegration` vazia — sem OAuth, sem endpoints, sem tela —
  que violaria a regra de "nunca criar tabela sem uso" (item 33), o campo
  `repoUrl` em `ProjectProgress` já resolve a necessidade real desta fase
  (guardar o link do repositório) através de um campo digitado manualmente.
  Quando a integração OAuth de fato for construída, ela populará esse mesmo
  campo — a tabela extra só faria sentido se guardasse token/escopo de OAuth,
  o que ainda não existe.

## Schema e decisões da Fase 6

```
User.xp, User.currentStreak, User.longestStreak, User.lastActivityDate
Achievement ── UserAchievement (userId, achievementId)
```

- **XP e streak direto no `User`**, não numa tabela `UserStats` separada:
  são sempre lidos junto com o perfil (header, dashboard) — um join constante
  não compensaria a separação.
- **Streak conta 1x por dia, não por ação** — resolver 10 exercícios no mesmo
  dia não infla a sequência 10x. Isso é o que o item 18 da spec pede
  explicitamente: gamificação não pode distorcer o objetivo educacional.
- **Conquistas são eventos reais do produto**, não marcos arbitrários:
  primeiro exercício resolvido, diagnóstico concluído, streak de 3 dias,
  primeiro projeto concluído — cada uma checada no service do domínio que a
  originou (`exercises`, `assessments`, `projects`), centralizadas em
  `gamification.service.ts` para não espalhar a lógica de XP pelo código.

## Fase 7: admin

`User.role` (`STUDENT` | `ADMIN`) checado a cada requisição via
`middleware/admin.ts` — deliberadamente não colocamos a role no payload do
JWT: se um admin for rebaixado, o efeito é imediato, não só depois do token
expirar. CRUD implementado para `Language`, `Course`, `Module`; o mesmo
padrão (service com validação de existência + rota com `requireAuth` +
`requireAdmin` + Zod) se replica identicamente para `Lesson`, `Exercise` e
`Project` — ver a nota de escopo em `docs/ROADMAP.md`.

## Fase 8: observabilidade e CI

- **Logs estruturados**: `pino` + `pino-http` substituem o `morgan` da Fase
  1 — saída legível em desenvolvimento (`pino-pretty`), JSON puro em produção
  (o formato que qualquer agregador de logs espera).
- **Request ID**: cada requisição recebe um ID (reaproveita um `x-request-id`
  já existente, se o cliente/proxy mandar um), devolvido no header de
  resposta e presente em todo log daquela requisição — rastreabilidade
  ponta a ponta dentro do backend.
- **`GET /health/ready`**: além do processo estar de pé (`/health`), checa se
  o Postgres e o Redis respondem — a diferença entre "o processo não
  crashou" e "esta réplica pode receber tráfego", que é o que um
  orquestrador real (Kubernetes, ECS) usa para gating de load balancer.
- **CI** (`.github/workflows/ci.yml`): a cada push/PR, `prisma generate` +
  typecheck + testes no backend, build de produção no frontend e typecheck no
  code-runner. Não sobe um Postgres real porque ainda não há testes que o usem —
  rodar migrations no CI sem testes que as exercitem seria teatro, não cobertura.
- **Logs sem credenciais**: o serializer padrão do `pino-http` inclui os headers da
  requisição (inclusive `Authorization`); a configuração `redact` do logger os
  remove, e há um teste que garante isso.

### O que continua fora do escopo, por honestidade

- Testes de integração contra um Postgres real e e2e no navegador (item 22).
  Existem 39 testes automatizados (lógica pura + API HTTP com banco/Redis
  simulados), mas nada exercita as queries reais do Prisma ainda — é a lacuna
  mais importante deste projeto hoje.
- Migrations versionadas: o ambiente de desenvolvimento usa `prisma db push`
  (ver `backend/Dockerfile`). Antes de produção, gere a migration inicial com
  `prisma migrate dev`, commite `prisma/migrations` e use `migrate deploy`.
- Tokens de refresh expirados/revogados nunca são apagados (falta um job de limpeza).
- Tracing distribuído entre backend → code-runner (útil para depurar uma
  execução lenta, mas exige infraestrutura — Jaeger/Tempo — que este ambiente
  de desenvolvimento não tem configurada).
- Secrets em variáveis de ambiente simples, não num secrets manager
  (Vault/AWS Secrets Manager) — aceitável para desenvolvimento, não para
  produção.
- Deploy real (Kubernetes/ECS, load balancer, múltiplas réplicas) — a
  arquitetura já é compatível com isso (ver diagrama de escalabilidade no
  início deste documento), mas os manifests em si não foram escritos
  (`infrastructure/` continua um placeholder documentado).
- A ressalva de segurança do `code-runner` (Docker-fora-do-Docker) do início
  da Fase 4 continua valendo — não foi revisitada aqui.

## O que fica para as próximas fases

Ver `docs/ROADMAP.md`.
