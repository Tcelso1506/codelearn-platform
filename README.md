# CodeLearn Platform

Plataforma SaaS de aprendizagem adaptativa de programação: diagnóstico de nível,
trilhas com exercícios corrigidos automaticamente, execução real e isolada de
código, projetos de portfólio, gamificação e painel administrativo.

Monorepo com quatro partes: `frontend` (React), `backend` (API Node/Express +
Prisma + PostgreSQL), `code-runner` (worker que executa código de usuário em
containers Docker efêmeros) e a infraestrutura local em `docker-compose.yml`.

Decisões técnicas em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), estado de
cada fase em [`docs/ROADMAP.md`](docs/ROADMAP.md).

## O que existe hoje

| Área | O que faz |
|---|---|
| Autenticação | Cadastro, login, logout, refresh token rotativo com detecção de reuso |
| Conteúdo | `Language → Course → Module → Lesson/Exercise` guardados no banco (aulas em Markdown) |
| Exercícios | Múltipla escolha e previsão de saída, com dica e feedback em camadas |
| Diagnóstico | Avaliação adaptativa por competências e tiers; nível, pontos fortes, lacunas e módulo recomendado |
| Playground | Execução real de Python em sandbox Docker (sem rede, com limites de CPU/memória/processos/tempo/saída) |
| Projetos | 3 projetos de portfólio (iniciante → avançado) com progresso e link do repositório |
| Gamificação | XP, nível, sequência diária de estudo e conquistas |
| Admin | Cadastro de linguagens, cursos e módulos, protegido por role `ADMIN` |
| Operação | Logs JSON estruturados (sem credenciais), request ID, `/health` e `/health/ready`, CI |

Só **Python** tem conteúdo e execução implementados; a arquitetura comporta outras
linguagens (ver `code-runner/README.md`).

## Como rodar

**Pré-requisito:** Docker (Docker Desktop no Mac/Windows, ou Docker Engine + Compose no Linux).

```bash
cp .env.example .env
docker compose up --build
```

Quando os logs mostrarem `API rodando em http://localhost:3333`, abra
**http://localhost:5173**, crie uma conta e explore.

Ao subir, o backend já cria as tabelas (`prisma db push`) e popula o conteúdo de
exemplo (o seed é idempotente — pode subir quantas vezes quiser). O
`code-runner` baixa a imagem `python:3.12-alpine` na primeira vez, então a
primeira execução no Playground pode esperar esse download terminar.

Serviços e portas: frontend `5173`, backend `3333`, postgres `5432`, redis `6379`.

### Virar administrador

Cadastre-se pelo site e depois rode:

```bash
docker compose exec backend npm run make-admin -- seu-email@exemplo.com
```

Faça logout/login (ou recarregue) e o link **Admin** aparece no topo do dashboard.

### Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Playground fica em "Executando" e depois avisa que demora | `code-runner` fora do ar ou sem acesso ao Docker | `docker compose logs code-runner`; no Linux, confira a permissão no `/var/run/docker.sock` |
| Erro de conexão com o banco ao trocar `POSTGRES_PASSWORD` | O volume do Postgres foi criado com a senha antiga | `docker compose down -v` (apaga os dados locais) e suba de novo |
| Erro de módulo/dependência após atualizar o código | Volumes de `node_modules` desatualizados | `docker compose down -v && docker compose up --build` |
| Erro de Prisma citando `libssl`/`openssl` | Imagem base sem OpenSSL | Já tratado nos Dockerfiles (`apk add openssl`); rebuild com `--build` |

## Desenvolvimento sem Docker

Requer Node 20+, PostgreSQL e Redis rodando localmente (ajuste `DATABASE_URL` e
`REDIS_URL` no `.env`, e exporte-as ou use um `.env` dentro de `backend/`).

```bash
# backend
cd backend && npm install
npx prisma db push && npm run prisma:seed
npm run dev

# frontend
cd frontend && npm install && npm run dev

# code-runner (precisa de Docker instalado no host)
cd code-runner && npm install && npx prisma generate && npm run dev
```

## Testes e verificações

```bash
cd backend
npm test            # 39 testes: lógica pura + API HTTP com banco/Redis simulados
npm run typecheck   # tsc completo com os tipos reais do Prisma

cd ../frontend && npm run build    # tsc + build de produção do Vite
```

O CI (`.github/workflows/ci.yml`) roda tudo isso a cada push/PR.

## Endpoints

```
Auth          POST /auth/register · /auth/login · /auth/refresh · /auth/logout     GET /users/me
Saúde         GET /health · /health/ready
Conteúdo      GET /languages · /languages/:id · /courses · /courses/:id · /modules/:id
Exercícios    GET /exercises/:id            POST /exercises/:id/submit   (auth)
Progresso     GET /progress · /skills       (auth)
Diagnóstico   POST /assessments/start · /assessments/:id/answer · /assessments/:id/finish   GET /assessments/:id   (auth)
Código        POST /code/execute            GET /code/execute/:id        (auth)
Projetos      GET /projects · /projects/:id     GET /projects/progress · POST /projects/:id/start · /projects/:id/complete   (auth)
Gamificação   GET /gamification/summary     (auth)
Admin         POST/PUT/DELETE /admin/languages · /admin/courses · /admin/modules   (role ADMIN)
```

## Estrutura

```
.github/workflows/ci.yml
frontend/        React + Vite + TypeScript + Tailwind
backend/         API Express + Prisma (schema em backend/prisma/schema.prisma; testes em backend/tests)
code-runner/     Worker BullMQ que executa código em containers Docker efêmeros
docs/            ARCHITECTURE.md e ROADMAP.md
docker-compose.yml · .env.example
```

## O que foi (e o que não foi) verificado

Seja qual for a sua leitura deste projeto, vale saber exatamente o que já foi
comprovado e o que ainda depende de você rodar:

**Verificado automaticamente:** schema Prisma válido e cliente gerado; type-check
completo dos três serviços; build de produção do frontend; 39 testes (lógica de
respostas/XP/sequência/senhas/tokens e a API HTTP real com autenticação,
autorização, validação, rotação e reuso de refresh token, guardas de admin,
validações da execução de código e remoção de credenciais dos logs); transporte do
código do usuário para o sandbox com aspas, quebras de linha e caracteres especiais.

**Ainda não verificado de ponta a ponta** (exige serviços que não estavam
disponíveis onde o código foi escrito): `docker compose up` com Postgres, Redis e
Docker reais; as queries contra um Postgres de verdade; e a execução do sandbox
com um daemon Docker. Se algo falhar na primeira subida, é aí que estará — mande a
mensagem de erro.

## Limitações conhecidas

Itens da especificação original que **não** foram implementados:

- **Testes de integração com banco real e e2e no navegador** (existem testes
  unitários e HTTP com banco simulado, mas nada contra Postgres real ainda).
- **Recuperação de senha** (exige envio de e-mail), perfil/configurações do
  usuário, onboarding e landing page.
- **Internacionalização** (pt/en): os textos estão em português, direto nos componentes.
- **Integração com GitHub** (OAuth, criar repositório, gerar README): só existe o campo
  de link do repositório, aceito apenas para `https://github.com/...`.
- **Admin completo:** só `Language`/`Course`/`Module`, e só criação pela interface
  (editar/excluir existe na API). Aulas, exercícios, perguntas de diagnóstico e
  projetos ainda são cadastrados pelo seed.
- **Outras linguagens** além de Python; **tipos de exercício** além de múltipla
  escolha e previsão de saída (não há correção de código livre por testes).
- **Produção real:** migrations versionadas (o dev usa `db push`; veja o
  Dockerfile), secrets manager, tracing, limpeza de refresh tokens expirados,
  deploy (Kubernetes/ECS) e o endurecimento do sandbox descrito em
  `code-runner/README.md` (o worker acessa o socket do Docker do host).
- Os tokens de login ficam no `localStorage` (padrão simples; para produção,
  prefira cookies `httpOnly`).
