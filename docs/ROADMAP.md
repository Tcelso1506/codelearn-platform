# Roadmap

- [x] **Fase 1 — Fundação**: monorepo, frontend, backend, banco, Docker, autenticação.
- [x] **Fase 2 — Aprendizagem**: `Language`, `Course`, `Module`, `Lesson`, `Exercise`, progresso por módulo (Python: Fundamentos → Controle de fluxo, com múltipla escolha e previsão de saída).
- [x] **Fase 3 — Diagnóstico**: `Skill`, `AssessmentQuestion`, `AssessmentAttempt`, `AssessmentAnswer`, `UserSkill`; motor adaptativo por tiers de competência, nível final (Iniciante/Intermediário/Avançado), pontos fortes/lacunas e recomendação de módulo.
- [x] **Fase 4 — Code Runner**: serviço `code-runner` separado, fila BullMQ/Redis, execução em container Docker efêmero (só Python nesta fase), limites de CPU/memória/processos/rede/filesystem/tempo/output, `POST /code/execute` + `GET /code/execute/:id`, Playground no frontend. Ver `code-runner/README.md` para os limites de segurança da abordagem Docker-fora-do-Docker usada aqui e o caminho recomendado (gVisor/Firecracker) para produção.
- [x] **Fase 5 — Projetos**: `Project` (3 projetos reais de Python: Calculadora, Gerenciador de Tarefas, Analisador de Notas CSV) e `ProjectProgress` com `repoUrl` — módulo "preparado para GitHub" via campo manual, sem OAuth ainda (ver decisão em `docs/ARCHITECTURE.md`).
- [x] **Fase 6 — Gamificação**: XP, nível (`xp/100 + 1`), streak diário (não por ação — item 18 da spec: gamificação não pode distorcer o objetivo educacional), 4 conquistas reais ligadas a eventos do produto (primeiro exercício, diagnóstico completo, streak de 3 dias, primeiro projeto).
- [x] **Fase 7 — Admin**: CRUD real com controle de acesso (`role: ADMIN`) para `Language`, `Course` e `Module` — o início da hierarquia de conteúdo. `Lesson`, `Exercise` e `Project` seguem exatamente o mesmo padrão de rota/serviço e ficam para a próxima iteração deste painel (não implementados ainda — ver nota de escopo abaixo).
- [x] **Fase 8 — Produção (parcial, ver nota abaixo)**: logging estruturado (`pino`/`pino-http`, JSON em produção), request ID por requisição, `GET /health/ready` checando banco e Redis, CI (`GitHub Actions`) rodando typecheck, testes e build a cada push/PR; 39 testes automatizados (lógica pura + API HTTP com banco/Redis simulados).

## Nota de escopo honesta sobre as Fases 7 e 8

Seguindo o método pedido na spec (item 32: trabalhar por fases, não fingir que
algo está pronto quando não está), as Fases 7 e 8 aqui são bases reais e
funcionais, não a versão completa do item 27/23 da spec:

- **Admin (Fase 7):** só 3 das ~10 entidades administráveis listadas no item
  27 têm CRUD implementado. O padrão (service + rotas + `requireAdmin`) é
  idêntico para as demais — é repetição mecânica, não um problema de design —
  mas implementá-las todas agora só infla o código sem ensinar nada de novo
  sobre a arquitetura.
- **Produção (Fase 8):** o que existe (logs estruturados, readiness check, CI
  de typecheck/build) é real e funciona. O que falta para produção de verdade
  — e que não foi implementado para não fingir uma infraestrutura que este
  ambiente de desenvolvimento não tem — está listado em
  `docs/ARCHITECTURE.md`: tracing distribuído, agregação de logs, testes de
  integração contra Postgres real e e2e (item 22 da spec), migrations
  versionadas, secrets manager, deploy real (k8s/ECS), CDN, e substituir a
  abordagem Docker-fora-do-Docker do `code-runner` por gVisor/Firecracker.

## Fora da spec original, ainda pendentes

Recuperação de senha, perfil/configurações, onboarding/landing, internacionalização
(pt/en), integração real com GitHub, outras linguagens além de Python e tipos de
exercício além de múltipla escolha/previsão de saída. Ver a lista completa em `README.md`.
