import { PrismaClient, ExerciseType, ExerciseDifficulty, ProjectLevel } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPython() {
  const python = await prisma.language.upsert({
    where: { slug: "python" },
    update: {},
    create: {
      slug: "python",
      name: "Python",
      description: "Linguagem de propósito geral, ótima para começar em programação e dados.",
    },
  });

  const course = await prisma.course.upsert({
    where: { languageId_slug: { languageId: python.id, slug: "fundamentos" } },
    update: {},
    create: {
      languageId: python.id,
      slug: "fundamentos",
      title: "Fundamentos de Python",
      description: "Variáveis, controle de fluxo, funções e as primeiras estruturas de dados.",
      order: 1,
    },
  });

  const moduleControle = await prisma.module.upsert({
    where: { courseId_slug: { courseId: course.id, slug: "controle-de-fluxo" } },
    update: {},
    create: {
      courseId: course.id,
      slug: "controle-de-fluxo",
      title: "Controle de fluxo",
      description: "Condicionais e loops: a base de qualquer programa.",
      order: 1,
      minMasteryPercent: 70,
      minExercises: 4,
    },
  });

  // Lesson não tem chave única natural: só cria se o módulo ainda não tiver aulas
  // (senão cada execução do seed duplicaria as aulas).
  const existingLessons = await prisma.lesson.count({ where: { moduleId: moduleControle.id } });

  if (existingLessons === 0) await prisma.lesson.createMany({
    data: [
      {
        moduleId: moduleControle.id,
        title: "Condicionais (if/elif/else)",
        content:
          "# Condicionais\n\nEm Python, `if`, `elif` e `else` controlam qual bloco de código executa " +
          "com base em uma condição booleana.\n\n```python\nidade = 20\nif idade >= 18:\n    print(\"maior de idade\")\nelse:\n    print(\"menor de idade\")\n```",
        order: 1,
      },
      {
        moduleId: moduleControle.id,
        title: "Loops (for/while)",
        content:
          "# Loops\n\n`for` percorre uma sequência; `while` repete enquanto uma condição for verdadeira.\n\n" +
          "```python\nfor i in range(3):\n    print(i)\n```\n\nSaída: `0`, `1`, `2` — o `range(3)` gera de 0 até 2, sem incluir o 3.",
        order: 2,
      },
    ],
  });

  const existingExercises = await prisma.exercise.count({ where: { moduleId: moduleControle.id } });

  if (existingExercises === 0) {
    await prisma.exercise.createMany({
      data: [
        {
          moduleId: moduleControle.id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.EASY,
          order: 1,
          prompt: "Qual operador é usado para verificar igualdade entre dois valores em Python?",
          options: [
            { id: "a", text: "=" },
            { id: "b", text: "==" },
            { id: "c", text: "===" },
            { id: "d", text: "eq" },
          ],
          correctAnswer: "b",
          explanation: "Em Python, `=` atribui um valor; `==` compara dois valores.",
          hint: "Pense na diferença entre atribuir um valor e comparar dois valores.",
        },
        {
          moduleId: moduleControle.id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.EASY,
          order: 2,
          prompt: "Qual é a saída do código abaixo?",
          starterCode: "x = 7\nif x > 5:\n    print(\"grande\")\nelse:\n    print(\"pequeno\")",
          correctAnswer: "grande",
          explanation: "Como `x` (7) é maior que 5, a condição `x > 5` é verdadeira e imprime \"grande\".",
          hint: "Compare o valor de x com 5.",
        },
        {
          moduleId: moduleControle.id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 3,
          prompt: "Qual é a saída do código abaixo?",
          starterCode: "total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)",
          correctAnswer: "6",
          explanation: "O laço soma 1 + 2 + 3 = 6. `range(1, 4)` vai de 1 até 3, sem incluir o 4.",
          hint: "Some manualmente os valores que `range(1, 4)` gera.",
        },
        {
          moduleId: moduleControle.id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 4,
          prompt: "O que `range(2, 10, 2)` gera?",
          options: [
            { id: "a", text: "2, 4, 6, 8" },
            { id: "b", text: "2, 4, 6, 8, 10" },
            { id: "c", text: "0, 2, 4, 6, 8" },
            { id: "d", text: "2, 3, 4, ..., 9" },
          ],
          correctAnswer: "a",
          explanation: "O terceiro argumento de `range` é o passo. De 2 até 10 (exclusivo), pulando de 2 em 2: 2, 4, 6, 8.",
          hint: "O terceiro número em `range(início, fim, passo)` é o incremento.",
        },
        {
          moduleId: moduleControle.id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.HARD,
          order: 5,
          prompt: "Qual é a saída do código abaixo?",
          starterCode:
            "n = 0\nwhile n < 5:\n    if n == 3:\n        break\n    n += 1\nprint(n)",
          correctAnswer: "3",
          explanation: "O laço incrementa n até que n seja igual a 3, momento em que o `break` interrompe o laço antes do incremento final.",
          hint: "Siga o valor de n a cada iteração e preste atenção em quando o `break` acontece.",
        },
      ],
    });
  }

  // ── Fase 3: skills e perguntas de diagnóstico ────────────────────────

  const skillDefs: { slug: string; name: string; tier: number; order: number }[] = [
    { slug: "sintaxe-variaveis", name: "Sintaxe e Variáveis", tier: 1, order: 1 },
    { slug: "logica-operadores", name: "Lógica e Operadores", tier: 1, order: 2 },
    { slug: "estruturas-de-controle", name: "Estruturas de Controle", tier: 2, order: 1 },
    { slug: "funcoes", name: "Funções", tier: 2, order: 2 },
    { slug: "estruturas-de-dados", name: "Estruturas de Dados", tier: 3, order: 1 },
    { slug: "debugging", name: "Debugging", tier: 3, order: 2 },
  ];

  const skills: Record<string, { id: string }> = {};
  for (const def of skillDefs) {
    skills[def.slug] = await prisma.skill.upsert({
      where: { languageId_slug: { languageId: python.id, slug: def.slug } },
      update: {},
      create: { languageId: python.id, ...def },
    });
  }

  const existingQuestions = await prisma.assessmentQuestion.count({ where: { languageId: python.id } });

  if (existingQuestions === 0) {
    await prisma.assessmentQuestion.createMany({
      data: [
        // Sintaxe e Variáveis
        {
          languageId: python.id,
          skillId: skills["sintaxe-variaveis"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.EASY,
          order: 1,
          prompt: "Qual dessas é uma forma válida de declarar uma variável em Python?",
          options: [
            { id: "a", text: "var x = 5" },
            { id: "b", text: "x = 5" },
            { id: "c", text: "int x = 5" },
            { id: "d", text: "let x = 5" },
          ],
          correctAnswer: "b",
          explanation: "Python não exige palavra-chave nem tipo declarado: `x = 5` já cria e tipa a variável dinamicamente.",
        },
        {
          languageId: python.id,
          skillId: skills["sintaxe-variaveis"].id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 2,
          prompt: "Qual é a saída do código abaixo?",
          starterCode: 'x = "5"\ny = 5\nprint(x + str(y))',
          correctAnswer: "55",
          explanation: "`x` é uma string \"5\"; `str(y)` converte o inteiro 5 em string \"5\"; concatenar strings junta os caracteres: \"55\".",
        },
        // Lógica e Operadores
        {
          languageId: python.id,
          skillId: skills["logica-operadores"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.EASY,
          order: 1,
          prompt: "Qual expressão abaixo é avaliada como True?",
          options: [
            { id: "a", text: "3 > 5" },
            { id: "b", text: "not False" },
            { id: "c", text: "1 == 2" },
            { id: "d", text: "0 and 1" },
          ],
          correctAnswer: "b",
          explanation: "`not False` inverte False para True. As outras três são False.",
        },
        {
          languageId: python.id,
          skillId: skills["logica-operadores"].id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 2,
          prompt: "Qual é a saída do código abaixo?",
          starterCode: "print(True and False or True)",
          correctAnswer: "True",
          explanation: "`and` tem precedência maior que `or`: primeiro calcula `True and False` (False), depois `False or True` (True).",
        },
        // Estruturas de Controle
        {
          languageId: python.id,
          skillId: skills["estruturas-de-controle"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.EASY,
          order: 1,
          prompt: "O que `elif` representa em Python?",
          options: [
            { id: "a", text: "Uma abreviação de \"else if\"" },
            { id: "b", text: "O fim de um bloco condicional" },
            { id: "c", text: "Um tipo de loop" },
            { id: "d", text: "Não existe em Python" },
          ],
          correctAnswer: "a",
          explanation: "`elif` é a forma do Python de encadear \"senão, se outra condição\" sem aninhar múltiplos `if`.",
        },
        {
          languageId: python.id,
          skillId: skills["estruturas-de-controle"].id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 2,
          prompt: "Qual é a saída do código abaixo?",
          starterCode: 'x = 10\nif x > 15:\n    print("A")\nelif x > 5:\n    print("B")\nelse:\n    print("C")',
          correctAnswer: "B",
          explanation: "x (10) não é maior que 15, mas é maior que 5 — a segunda condição (`elif x > 5`) é a primeira verdadeira.",
        },
        // Funções
        {
          languageId: python.id,
          skillId: skills["funcoes"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.EASY,
          order: 1,
          prompt: "Qual palavra-chave define uma função em Python?",
          options: [
            { id: "a", text: "function" },
            { id: "b", text: "def" },
            { id: "c", text: "func" },
            { id: "d", text: "method" },
          ],
          correctAnswer: "b",
          explanation: "Funções em Python são declaradas com `def nome(parametros):`.",
        },
        {
          languageId: python.id,
          skillId: skills["funcoes"].id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 2,
          prompt: "Qual é a saída do código abaixo?",
          starterCode: "def dobro(n):\n    return n * 2\n\nprint(dobro(4) + 1)",
          correctAnswer: "9",
          explanation: "`dobro(4)` retorna 8; somado a 1, resulta em 9.",
        },
        // Estruturas de Dados
        {
          languageId: python.id,
          skillId: skills["estruturas-de-dados"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 1,
          prompt: "Qual dessas estruturas de dados do Python é imutável?",
          options: [
            { id: "a", text: "list" },
            { id: "b", text: "dict" },
            { id: "c", text: "tuple" },
            { id: "d", text: "set" },
          ],
          correctAnswer: "c",
          explanation: "Tuplas (`tuple`) não podem ser alteradas após criadas; listas, dicionários e conjuntos são mutáveis.",
        },
        {
          languageId: python.id,
          skillId: skills["estruturas-de-dados"].id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.HARD,
          order: 2,
          prompt: "Qual é a saída do código abaixo?",
          starterCode: 'd = {"a": 1, "b": 2}\nd["a"] += 10\nprint(d["a"])',
          correctAnswer: "11",
          explanation: "`d[\"a\"] += 10` soma 10 ao valor atual (1), resultando em 11.",
        },
        // Debugging
        {
          languageId: python.id,
          skillId: skills["debugging"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 1,
          prompt: "Qual exceção o Python lança ao acessar uma chave inexistente em um dicionário?",
          options: [
            { id: "a", text: "IndexError" },
            { id: "b", text: "KeyError" },
            { id: "c", text: "ValueError" },
            { id: "d", text: "TypeError" },
          ],
          correctAnswer: "b",
          explanation: "Chaves de dicionário ausentes disparam `KeyError`; `IndexError` é para índices de sequência fora do intervalo.",
        },
        {
          languageId: python.id,
          skillId: skills["debugging"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.HARD,
          order: 2,
          prompt:
            "O que acontece ao executar este código?\n\ndef soma(lista):\n    total = 0\n    for i in range(len(lista) + 1):\n        total += lista[i]\n    return total\n\nprint(soma([1, 2, 3]))",
          options: [
            { id: "a", text: "Imprime 6" },
            { id: "b", text: "Lança IndexError" },
            { id: "c", text: "Lança TypeError" },
            { id: "d", text: "Imprime 0" },
          ],
          correctAnswer: "b",
          explanation: "`range(len(lista) + 1)` vai um índice além do fim da lista (0 a 3, mas a lista só tem índices 0 a 2) — acessar `lista[3]` lança IndexError.",
        },
      ],
    });
  }

  // ── Fase 5: projetos de portfólio ─────────────────────────────────────

  const existingProjects = await prisma.project.count({ where: { languageId: python.id } });

  if (existingProjects === 0) {
    await prisma.project.createMany({
      data: [
        {
          languageId: python.id,
          slug: "calculadora-terminal",
          title: "Calculadora de Terminal",
          level: ProjectLevel.BEGINNER,
          order: 1,
          objective: "Praticar funções, condicionais e tratamento de erros construindo uma calculadora de linha de comando.",
          problem:
            "Muita gente aprende operadores matemáticos mas nunca junta isso num programa que reage a entradas inválidas. Este projeto força você a lidar com entrada do usuário no mundo real: texto que não é número, divisão por zero, opção inexistente.",
          stack: "Python (sem dependências externas)",
          requirements: [
            "Menu de texto com as operações: soma, subtração, multiplicação, divisão",
            "Ler dois números do usuário via input()",
            "Tratar entrada inválida (texto que não é número) sem quebrar o programa",
            "Tratar divisão por zero com uma mensagem clara, não um traceback",
            "Repetir o menu até o usuário escolher sair",
          ],
          features: [
            "Histórico das últimas 5 operações realizadas na sessão",
            "Opção de calcular potência e raiz quadrada",
          ],
          bonusChallenges: [
            "Salvar o histórico em um arquivo texto ao sair",
            "Aceitar expressões como \"2 + 2\" numa linha só, em vez de menu",
          ],
          successCriteria: [
            "O programa nunca fecha com um erro não tratado por entrada inválida",
            "Todas as 4 operações básicas funcionam corretamente",
            "Código organizado em funções (uma por operação, no mínimo)",
          ],
          suggestedStructure: "calculadora/\n├── calculadora.py\n└── README.md",
          suggestedReadme:
            "# Calculadora de Terminal\n\nCalculadora de linha de comando em Python com tratamento de erros.\n\n## Como rodar\n```\npython calculadora.py\n```\n\n## Operações suportadas\n- Soma, subtração, multiplicação, divisão",
          futureImprovements: [
            "Interface gráfica simples com tkinter",
            "Suporte a números complexos",
          ],
        },
        {
          languageId: python.id,
          slug: "gerenciador-tarefas",
          title: "Gerenciador de Tarefas (To-Do List)",
          level: ProjectLevel.INTERMEDIATE,
          order: 2,
          objective:
            "Praticar estruturas de dados (listas e dicionários), funções e persistência de dados em arquivo.",
          problem:
            "Um programa útil de verdade precisa lembrar de informação entre execuções. Este projeto simula isso sem precisar de um banco de dados: você lê e escreve um arquivo JSON a cada operação.",
          stack: "Python + módulo `json` da biblioteca padrão",
          requirements: [
            "Adicionar uma tarefa com título e status (pendente/concluída)",
            "Listar todas as tarefas, indicando visualmente quais estão concluídas",
            "Marcar uma tarefa como concluída pelo número/índice",
            "Remover uma tarefa",
            "Persistir as tarefas em um arquivo `tarefas.json` entre execuções",
          ],
          features: [
            "Filtrar a listagem por pendentes/concluídas",
            "Data de criação de cada tarefa",
          ],
          bonusChallenges: [
            "Prioridade (alta/média/baixa) com ordenação na listagem",
            "Exportar as tarefas concluídas da semana para um relatório em texto",
          ],
          successCriteria: [
            "As tarefas sobrevivem ao fechar e reabrir o programa",
            "Nenhuma operação corrompe o arquivo JSON (tratar arquivo ausente/vazio na primeira execução)",
            "Código dividido em funções, uma por operação (adicionar, listar, concluir, remover, salvar, carregar)",
          ],
          suggestedStructure: "gerenciador-tarefas/\n├── main.py\n├── tarefas.json\n└── README.md",
          suggestedReadme:
            "# Gerenciador de Tarefas\n\nCLI em Python para gerenciar tarefas com persistência em JSON.\n\n## Como rodar\n```\npython main.py\n```\n\n## Funcionalidades\n- Adicionar, listar, concluir e remover tarefas\n- Dados salvos em `tarefas.json`",
          futureImprovements: [
            "Migrar a persistência de JSON para SQLite",
            "Expor as mesmas operações como uma API REST",
          ],
        },
        {
          languageId: python.id,
          slug: "analisador-notas-csv",
          title: "Analisador de Notas (CSV)",
          level: ProjectLevel.ADVANCED,
          order: 3,
          objective:
            "Praticar leitura de arquivos estruturados, agregação de dados e lógica de decisão mais complexa.",
          problem:
            "Dados do mundo real quase sempre chegam em CSV. Este projeto pega uma lista de alunos e notas e transforma isso num relatório com estatísticas — o tipo de tarefa que aparece o tempo todo em automações reais.",
          stack: "Python + módulo `csv` da biblioteca padrão",
          requirements: [
            "Ler um arquivo CSV com colunas: nome, nota1, nota2, nota3",
            "Calcular a média de cada aluno",
            "Classificar cada aluno como Aprovado (média ≥ 6) ou Reprovado",
            "Calcular a média geral da turma",
            "Gerar um relatório em texto com os resultados, ordenado por média (maior para menor)",
          ],
          features: [
            "Identificar o aluno com a maior e a menor média",
            "Tratar linhas malformadas do CSV sem derrubar o programa inteiro",
          ],
          bonusChallenges: [
            "Gerar o relatório também em formato CSV de saída",
            "Aceitar o nome do arquivo de entrada como argumento de linha de comando",
          ],
          successCriteria: [
            "O relatório bate com um cálculo manual feito numa planilha de teste",
            "Uma linha malformada no CSV gera um aviso, não uma exceção não tratada",
            "Código organizado em funções: ler dados, calcular estatísticas, gerar relatório",
          ],
          suggestedStructure:
            "analisador-notas/\n├── main.py\n├── alunos.csv\n├── relatorio.txt\n└── README.md",
          suggestedReadme:
            "# Analisador de Notas\n\nLê um CSV de notas e gera um relatório com médias e status de aprovação.\n\n## Como rodar\n```\npython main.py alunos.csv\n```",
          futureImprovements: [
            "Visualização gráfica das médias com matplotlib",
            "Suporte a pesos diferentes por avaliação",
          ],
        },
      ],
    });
  }

}

// ── SQL ─────────────────────────────────────────────────────────────────
//
// Mesmo esqueleto do Python. Restrições do produto que moldam o conteúdo:
// só existem MULTIPLE_CHOICE e OUTPUT_PREDICTION, e a resposta de previsão de
// saída é um campo de uma linha — por isso toda previsão de saída em SQL tem
// como resposta um único valor (um nome ou um número), nunca uma tabela. As
// tabelas de apoio vão no `starterCode` (comentários SQL), que a UI exibe em
// bloco de código preservando as quebras de linha.

const TABELA_ALUNOS =
  "-- alunos(id, nome, nota)\n" +
  "-- (1, 'Ana', 8)  (2, 'Bruno', 5)  (3, 'Carla', 9)\n" +
  "-- (4, 'Diego', 6)  (5, 'Elisa', 7)\n";

const TABELAS_MATRICULAS =
  "-- alunos(id, nome): Ana(1), Bruno(2), Carla(3), Diego(4), Elisa(5)\n" +
  "-- matriculas(aluno_id, curso_id): (1,1) (1,2) (2,1) (3,2)\n";

async function seedSql() {
  const sql = await prisma.language.upsert({
    where: { slug: "sql" },
    update: {},
    create: {
      slug: "sql",
      name: "SQL",
      description: "Linguagem para consultar e manipular dados em bancos relacionais.",
    },
  });

  const course = await prisma.course.upsert({
    where: { languageId_slug: { languageId: sql.id, slug: "fundamentos" } },
    update: {},
    create: {
      languageId: sql.id,
      slug: "fundamentos",
      title: "Fundamentos de SQL",
      description: "Consultas, filtros, ordenação, JOINs e agregações sobre bancos relacionais.",
      order: 1,
    },
  });

  const moduleBasico = await prisma.module.upsert({
    where: { courseId_slug: { courseId: course.id, slug: "consultas-basicas" } },
    update: {},
    create: {
      courseId: course.id,
      slug: "consultas-basicas",
      title: "Consultas básicas",
      description: "SELECT, WHERE, ORDER BY e LIMIT: como pedir dados ao banco.",
      order: 1,
      minMasteryPercent: 70,
      minExercises: 4,
    },
  });

  const moduleJoins = await prisma.module.upsert({
    where: { courseId_slug: { courseId: course.id, slug: "joins-e-agregacoes" } },
    update: {},
    create: {
      courseId: course.id,
      slug: "joins-e-agregacoes",
      title: "JOINs e agregações",
      description: "Combine tabelas com JOIN e resuma dados com COUNT, SUM, AVG e GROUP BY.",
      order: 2,
      minMasteryPercent: 70,
      minExercises: 4,
    },
  });

  // Lesson e Exercise não têm chave única natural: só cria se o módulo ainda estiver vazio.
  if ((await prisma.lesson.count({ where: { moduleId: moduleBasico.id } })) === 0) {
    await prisma.lesson.createMany({
      data: [
        {
          moduleId: moduleBasico.id,
          title: "SELECT e FROM",
          content:
            "# SELECT e FROM\n\nUm banco relacional guarda dados em **tabelas**: linhas (registros) e colunas (campos). " +
            "O `SELECT` escolhe quais colunas você quer ver e o `FROM` diz de qual tabela elas vêm.\n\n" +
            "```sql\n-- todas as colunas\nSELECT * FROM alunos;\n\n-- só algumas colunas\nSELECT nome, nota FROM alunos;\n```\n\n" +
            "Você também pode calcular valores e dar nomes às colunas do resultado com `AS`:\n\n" +
            "```sql\nSELECT nome, nota * 10 AS nota_de_0_a_100 FROM alunos;\n```\n\n" +
            "> Palavras-chave como `SELECT` não diferenciam maiúsculas de minúsculas, mas escrevê-las em maiúsculas deixa a consulta mais legível.",
          order: 1,
        },
        {
          moduleId: moduleBasico.id,
          title: "Filtrando e ordenando (WHERE, ORDER BY, LIMIT)",
          content:
            "# Filtrando e ordenando\n\n`WHERE` mantém só as linhas que satisfazem uma condição. Use `=` para igualdade " +
            "(não `==`), `<>` para diferente, e combine condições com `AND`, `OR` e `NOT`.\n\n" +
            "```sql\nSELECT nome FROM alunos WHERE nota >= 7 AND nome <> 'Ana';\nSELECT nome FROM alunos WHERE nota BETWEEN 6 AND 8;\n```\n\n" +
            "`ORDER BY` ordena o resultado (`ASC` é o padrão, `DESC` inverte). `LIMIT` restringe quantas linhas voltam e " +
            "`OFFSET` pula as primeiras:\n\n" +
            "```sql\nSELECT nome FROM alunos ORDER BY nota DESC LIMIT 3;          -- as 3 maiores notas\n" +
            "SELECT nome FROM alunos ORDER BY nota DESC LIMIT 1 OFFSET 1;  -- a segunda maior\n```\n\n" +
            "A ordem escrita é sempre: `SELECT` → `FROM` → `WHERE` → `ORDER BY` → `LIMIT`.\n\n" +
            "> Cuidado com `NULL`: ele representa \"valor desconhecido\". Para testá-lo, use `IS NULL` — `= NULL` nunca é verdadeiro.",
          order: 2,
        },
      ],
    });
  }

  if ((await prisma.lesson.count({ where: { moduleId: moduleJoins.id } })) === 0) {
    await prisma.lesson.createMany({
      data: [
        {
          moduleId: moduleJoins.id,
          title: "JOIN: combinando tabelas",
          content:
            "# JOIN\n\nDados bem modelados ficam em tabelas separadas, ligadas por **chaves**: a chave primária (PK) identifica " +
            "cada linha e a chave estrangeira (FK) aponta para a PK de outra tabela. O `JOIN` junta as linhas relacionadas.\n\n" +
            "```sql\nSELECT a.nome, c.titulo\nFROM alunos a\nINNER JOIN matriculas m ON m.aluno_id = a.id\nINNER JOIN cursos c ON c.id = m.curso_id;\n```\n\n" +
            "- `INNER JOIN`: só linhas com correspondência nas **duas** tabelas.\n" +
            "- `LEFT JOIN`: todas as linhas da tabela da esquerda; sem correspondência, as colunas da direita vêm como `NULL`.\n\n" +
            "A condição vai no `ON`. Os apelidos (`a`, `m`, `c`) deixam a consulta curta e evitam ambiguidade entre colunas de mesmo nome.",
          order: 1,
        },
        {
          moduleId: moduleJoins.id,
          title: "Agregações e GROUP BY",
          content:
            "# Agregações e GROUP BY\n\nFunções de agregação resumem várias linhas em um valor: `COUNT`, `SUM`, `AVG`, `MIN` e `MAX`.\n\n" +
            "```sql\nSELECT COUNT(*) FROM alunos;      -- quantas linhas\nSELECT AVG(nota) FROM alunos;     -- média das notas\n```\n\n" +
            "`GROUP BY` divide as linhas em grupos e aplica a agregação em cada um:\n\n" +
            "```sql\nSELECT curso_id, COUNT(*) AS total\nFROM matriculas\nGROUP BY curso_id;\n```\n\n" +
            "`WHERE` filtra **linhas antes** de agrupar; `HAVING` filtra **grupos depois** de agregar:\n\n" +
            "```sql\nSELECT curso_id, COUNT(*) AS total\nFROM matriculas\nGROUP BY curso_id\nHAVING COUNT(*) > 1;\n```\n\n" +
            "Regra de ouro: toda coluna no `SELECT` que não está dentro de uma função de agregação precisa estar no `GROUP BY`.",
          order: 2,
        },
      ],
    });
  }

  if ((await prisma.exercise.count({ where: { moduleId: moduleBasico.id } })) === 0) {
    await prisma.exercise.createMany({
      data: [
        {
          moduleId: moduleBasico.id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.EASY,
          order: 1,
          prompt: "Qual consulta retorna todas as colunas e todas as linhas da tabela alunos?",
          options: [
            { id: "a", text: "SELECT * FROM alunos;" },
            { id: "b", text: "GET * FROM alunos;" },
            { id: "c", text: "SELECT ALL alunos;" },
            { id: "d", text: "FETCH alunos;" },
          ],
          correctAnswer: "a",
          explanation: "`SELECT` escolhe as colunas (`*` significa todas) e `FROM` indica a tabela.",
          hint: "A consulta começa com a palavra-chave que escolhe colunas e termina indicando a tabela de origem.",
        },
        {
          moduleId: moduleBasico.id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.EASY,
          order: 2,
          prompt: "Considerando a tabela descrita nos comentários, qual nome a consulta retorna?",
          starterCode: TABELA_ALUNOS + "SELECT nome FROM alunos WHERE nota > 8;",
          correctAnswer: "Carla",
          explanation: "Só a Carla tem nota maior que 8 (a nota da Ana é 8, e `>` exclui o valor igual).",
          hint: "Procure as notas estritamente maiores que 8.",
        },
        {
          moduleId: moduleBasico.id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 3,
          prompt: "Qual nome a consulta retorna?",
          starterCode: TABELA_ALUNOS + "SELECT nome FROM alunos ORDER BY nota ASC LIMIT 1;",
          correctAnswer: "Bruno",
          explanation: "Ordenado da menor para a maior nota, o primeiro é o Bruno (5). `LIMIT 1` devolve só essa linha.",
          hint: "Ordene mentalmente as notas da menor para a maior e pegue a primeira.",
        },
        {
          moduleId: moduleBasico.id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 4,
          prompt: "Qual condição retorna os alunos com nota entre 6 e 8, inclusive?",
          options: [
            { id: "a", text: "WHERE nota BETWEEN 6 AND 8" },
            { id: "b", text: "WHERE nota IN (6, 8)" },
            { id: "c", text: "WHERE nota > 6 AND nota < 8" },
            { id: "d", text: "WHERE nota BETWEEN 6, 8" },
          ],
          correctAnswer: "a",
          explanation:
            "`BETWEEN 6 AND 8` inclui os extremos. A opção b só aceita 6 ou 8, a c exclui os extremos e a d tem sintaxe inválida.",
          hint: "Uma das opções inclui os valores das pontas; outra tem erro de sintaxe.",
        },
        {
          moduleId: moduleBasico.id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.HARD,
          order: 5,
          prompt: "Qual nome a consulta retorna?",
          starterCode:
            TABELA_ALUNOS + "SELECT nome FROM alunos\nWHERE nota < 8\nORDER BY nota DESC\nLIMIT 1 OFFSET 1;",
          correctAnswer: "Diego",
          explanation:
            "Com `nota < 8` sobram Bruno (5), Diego (6) e Elisa (7). Em ordem decrescente: Elisa, Diego, Bruno. " +
            "`OFFSET 1` pula a Elisa e `LIMIT 1` devolve o Diego.",
          hint: "Aplique primeiro o WHERE, depois a ordenação, depois pule uma linha.",
        },
      ],
    });
  }

  if ((await prisma.exercise.count({ where: { moduleId: moduleJoins.id } })) === 0) {
    await prisma.exercise.createMany({
      data: [
        {
          moduleId: moduleJoins.id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.EASY,
          order: 1,
          prompt: "Qual tipo de JOIN retorna apenas as linhas que têm correspondência nas duas tabelas?",
          options: [
            { id: "a", text: "INNER JOIN" },
            { id: "b", text: "LEFT JOIN" },
            { id: "c", text: "CROSS JOIN" },
            { id: "d", text: "RIGHT JOIN" },
          ],
          correctAnswer: "a",
          explanation:
            "O `INNER JOIN` descarta linhas sem par. `LEFT JOIN` e `RIGHT JOIN` preservam todas as linhas de um dos lados.",
          hint: "Pense em qual JOIN descarta as linhas sem correspondência.",
        },
        {
          moduleId: moduleJoins.id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.EASY,
          order: 2,
          prompt: "Qual valor a consulta retorna?",
          starterCode: TABELAS_MATRICULAS + "SELECT COUNT(*) FROM matriculas;",
          correctAnswer: "4",
          explanation: "`COUNT(*)` conta as linhas da tabela matriculas: são 4.",
          hint: "Conte as linhas da tabela matriculas.",
        },
        {
          moduleId: moduleJoins.id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 3,
          prompt: "Qual valor a consulta retorna?",
          starterCode:
            TABELAS_MATRICULAS +
            "SELECT COUNT(*)\nFROM alunos a\nLEFT JOIN matriculas m ON m.aluno_id = a.id;",
          correctAnswer: "6",
          explanation:
            "Ana aparece 2 vezes (duas matrículas), Bruno 1 e Carla 1. Diego e Elisa não têm matrícula, mas o `LEFT JOIN` " +
            "mantém cada um com uma linha (com `NULL` na direita): 2 + 1 + 1 + 1 + 1 = 6.",
          hint: "No LEFT JOIN, quem não tem correspondência ainda gera uma linha.",
        },
        {
          moduleId: moduleJoins.id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 4,
          prompt: "Qual cláusula filtra grupos depois de uma agregação com GROUP BY?",
          options: [
            { id: "a", text: "WHERE" },
            { id: "b", text: "FILTER BY" },
            { id: "c", text: "HAVING" },
            { id: "d", text: "ORDER BY" },
          ],
          correctAnswer: "c",
          explanation:
            "`WHERE` age sobre linhas antes de agrupar; `HAVING` age sobre os grupos já agregados (por exemplo `HAVING COUNT(*) > 1`).",
          hint: "Qual cláusula consegue usar funções como COUNT() na condição?",
        },
        {
          moduleId: moduleJoins.id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.HARD,
          order: 5,
          prompt: "Qual nome a consulta retorna?",
          starterCode:
            TABELAS_MATRICULAS +
            "SELECT a.nome\nFROM alunos a\nINNER JOIN matriculas m ON m.aluno_id = a.id\nGROUP BY a.nome\nHAVING COUNT(*) > 1;",
          correctAnswer: "Ana",
          explanation:
            "O JOIN liga cada aluno às suas matrículas; o `GROUP BY` agrupa por aluno e `HAVING COUNT(*) > 1` mantém só " +
            "quem tem mais de uma. Só a Ana tem 2 matrículas.",
          hint: "Conte quantas matrículas cada aluno tem.",
        },
      ],
    });
  }

  // ── Diagnóstico: skills e perguntas ──────────────────────────────────

  const skillDefs: { slug: string; name: string; tier: number; order: number }[] = [
    { slug: "consultas-select", name: "Consultas SELECT", tier: 1, order: 1 },
    { slug: "filtros-where", name: "Filtros e Operadores", tier: 1, order: 2 },
    { slug: "ordenacao-limite", name: "Ordenação e Limite", tier: 2, order: 1 },
    { slug: "joins", name: "JOINs", tier: 2, order: 2 },
    { slug: "agregacoes", name: "Agregações e GROUP BY", tier: 3, order: 1 },
    { slug: "modelagem-erros", name: "NULL e Depuração de Consultas", tier: 3, order: 2 },
  ];

  const skills: Record<string, { id: string }> = {};
  for (const def of skillDefs) {
    skills[def.slug] = await prisma.skill.upsert({
      where: { languageId_slug: { languageId: sql.id, slug: def.slug } },
      update: {},
      create: { languageId: sql.id, ...def },
    });
  }

  if ((await prisma.assessmentQuestion.count({ where: { languageId: sql.id } })) === 0) {
    await prisma.assessmentQuestion.createMany({
      data: [
        // Consultas SELECT
        {
          languageId: sql.id,
          skillId: skills["consultas-select"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.EASY,
          order: 1,
          prompt: "Qual consulta retorna apenas a coluna nome da tabela alunos?",
          options: [
            { id: "a", text: "SELECT nome FROM alunos;" },
            { id: "b", text: "SELECT FROM alunos nome;" },
            { id: "c", text: "GET nome FROM alunos;" },
            { id: "d", text: "SELECT alunos.* WHERE nome;" },
          ],
          correctAnswer: "a",
          explanation: "A forma básica é `SELECT <colunas> FROM <tabela>;`.",
        },
        {
          languageId: sql.id,
          skillId: skills["consultas-select"].id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 2,
          prompt: "A tabela alunos tem uma única linha. Qual valor a consulta retorna?",
          starterCode: "-- alunos(id, nome, nota): (1, 'Ana', 8)\nSELECT nota * 2 AS dobro FROM alunos;",
          correctAnswer: "16",
          explanation: "A expressão `nota * 2` é calculada para cada linha: 8 × 2 = 16. O `AS dobro` só renomeia a coluna do resultado.",
        },
        // Filtros e Operadores
        {
          languageId: sql.id,
          skillId: skills["filtros-where"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.EASY,
          order: 1,
          prompt: "Qual operador verifica igualdade em um WHERE?",
          options: [
            { id: "a", text: "=" },
            { id: "b", text: "==" },
            { id: "c", text: "===" },
            { id: "d", text: "EQUALS" },
          ],
          correctAnswer: "a",
          explanation: "Em SQL a igualdade é um único `=`. Não existe atribuição dentro do `WHERE`, então não há ambiguidade.",
        },
        {
          languageId: sql.id,
          skillId: skills["filtros-where"].id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 2,
          prompt: "Qual valor a consulta retorna?",
          starterCode: "-- t(x): 1, 2, 3, 4, 5\nSELECT COUNT(*) FROM t\nWHERE x > 1 AND x < 5 OR x = 5;",
          correctAnswer: "4",
          explanation:
            "`AND` tem precedência sobre `OR`: a condição é (x > 1 AND x < 5) OR x = 5. Passam 2, 3, 4 e 5 — quatro linhas.",
        },
        // Ordenação e Limite
        {
          languageId: sql.id,
          skillId: skills["ordenacao-limite"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.EASY,
          order: 1,
          prompt: "Como listar os alunos da maior para a menor nota?",
          options: [
            { id: "a", text: "ORDER BY nota ASC" },
            { id: "b", text: "ORDER BY nota DESC" },
            { id: "c", text: "SORT BY nota DESC" },
            { id: "d", text: "GROUP BY nota DESC" },
          ],
          correctAnswer: "b",
          explanation: "`ORDER BY ... DESC` ordena de forma decrescente. `ASC` (padrão) é crescente; `SORT BY` não existe no SQL padrão.",
        },
        {
          languageId: sql.id,
          skillId: skills["ordenacao-limite"].id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 2,
          prompt: "Qual nome a consulta retorna?",
          starterCode:
            TABELA_ALUNOS + "SELECT nome FROM alunos ORDER BY nota DESC LIMIT 1 OFFSET 2;",
          correctAnswer: "Elisa",
          explanation: "Em ordem decrescente: Carla (9), Ana (8), Elisa (7)... `OFFSET 2` pula as duas primeiras e `LIMIT 1` devolve a Elisa.",
        },
        // JOINs
        {
          languageId: sql.id,
          skillId: skills["joins"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.EASY,
          order: 1,
          prompt: "Qual cláusula define a condição de ligação entre duas tabelas em um JOIN?",
          options: [
            { id: "a", text: "ON" },
            { id: "b", text: "BY" },
            { id: "c", text: "LINK" },
            { id: "d", text: "WITH" },
          ],
          correctAnswer: "a",
          explanation: "A condição do JOIN vai no `ON`, por exemplo `ON m.aluno_id = a.id`.",
        },
        {
          languageId: sql.id,
          skillId: skills["joins"].id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 2,
          prompt: "Qual valor a consulta retorna?",
          starterCode:
            "-- clientes(id, nome): (1, 'Ana'), (2, 'Bruno')\n-- pedidos(id, cliente_id): (10, 1), (11, 1)\n" +
            "SELECT COUNT(*)\nFROM clientes c\nLEFT JOIN pedidos p ON p.cliente_id = c.id;",
          correctAnswer: "3",
          explanation: "A Ana tem 2 pedidos (2 linhas) e o Bruno não tem nenhum, mas o `LEFT JOIN` mantém uma linha para ele: 2 + 1 = 3.",
        },
        // Agregações e GROUP BY
        {
          languageId: sql.id,
          skillId: skills["agregacoes"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 1,
          prompt: "Qual função calcula a média de uma coluna numérica?",
          options: [
            { id: "a", text: "AVG" },
            { id: "b", text: "MEAN" },
            { id: "c", text: "AVERAGE" },
            { id: "d", text: "MED" },
          ],
          correctAnswer: "a",
          explanation: "A função de média no SQL padrão é `AVG`. As demais não existem na maioria dos bancos.",
        },
        {
          languageId: sql.id,
          skillId: skills["agregacoes"].id,
          type: ExerciseType.OUTPUT_PREDICTION,
          difficulty: ExerciseDifficulty.HARD,
          order: 2,
          prompt: "Qual valor a consulta retorna?",
          starterCode:
            "-- vendas(produto, valor): ('A', 10), ('A', 20), ('B', 5)\n" +
            "SELECT SUM(valor)\nFROM vendas\nGROUP BY produto\nHAVING SUM(valor) > 10;",
          correctAnswer: "30",
          explanation: "Os grupos somam A = 30 e B = 5. O `HAVING SUM(valor) > 10` descarta o B, restando só 30.",
        },
        // NULL e Depuração de Consultas
        {
          languageId: sql.id,
          skillId: skills["modelagem-erros"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.MEDIUM,
          order: 1,
          prompt: "Em um WHERE, o que acontece com a condição `coluna = NULL`?",
          options: [
            { id: "a", text: "É verdadeira para as linhas em que a coluna é nula" },
            { id: "b", text: "Causa um erro de sintaxe" },
            { id: "c", text: "Nunca é verdadeira: o resultado é desconhecido e a linha é descartada" },
            { id: "d", text: "É equivalente a coluna = 0" },
          ],
          correctAnswer: "c",
          explanation: "Comparar qualquer coisa com `NULL` resulta em desconhecido, que o `WHERE` trata como falso. Use `IS NULL`.",
        },
        {
          languageId: sql.id,
          skillId: skills["modelagem-erros"].id,
          type: ExerciseType.MULTIPLE_CHOICE,
          difficulty: ExerciseDifficulty.HARD,
          order: 2,
          prompt: "O que acontece ao executar a consulta abaixo na maioria dos bancos (como o PostgreSQL)?",
          starterCode: "SELECT nome, COUNT(*) FROM alunos;",
          options: [
            { id: "a", text: "Retorna cada nome com a contagem 1" },
            { id: "b", text: "Erro: nome precisa estar no GROUP BY ou dentro de uma função de agregação" },
            { id: "c", text: "Retorna apenas a contagem total" },
            { id: "d", text: "Retorna nome como NULL e a contagem total" },
          ],
          correctAnswer: "b",
          explanation:
            "Misturar uma coluna comum (`nome`) com uma agregação (`COUNT`) sem `GROUP BY` é inválido: o banco não sabe qual nome mostrar.",
        },
      ],
    });
  }

  // ── Projetos de portfólio ─────────────────────────────────────────────

  if ((await prisma.project.count({ where: { languageId: sql.id } })) === 0) {
    await prisma.project.createMany({
      data: [
        {
          languageId: sql.id,
          slug: "consultas-biblioteca",
          title: "Consultas em um Banco de Biblioteca",
          level: ProjectLevel.BEGINNER,
          order: 1,
          objective: "Praticar SELECT, WHERE, ORDER BY e LIMIT respondendo perguntas reais sobre um acervo de biblioteca.",
          problem:
            "Saber a sintaxe não basta: o desafio de verdade é traduzir uma pergunta de negócio em uma consulta. " +
            "Aqui você recebe um banco pronto e precisa extrair respostas dele.",
          stack: "SQLite ou PostgreSQL (qualquer cliente SQL)",
          requirements: [
            "Criar as tabelas livros(id, titulo, autor, ano, disponivel) e emprestimos(id, livro_id, leitor, data) e inserir ao menos 15 livros",
            "Escrever 8 consultas, cada uma respondendo a uma pergunta (ex.: livros publicados depois de 2000, em ordem de título)",
            "Usar WHERE com AND/OR, BETWEEN e LIKE em ao menos uma consulta cada",
            "Usar ORDER BY e LIMIT para listar os 5 livros mais antigos",
            "Documentar, em comentário SQL acima de cada consulta, a pergunta que ela responde",
          ],
          features: [
            "Buscar livros por parte do título com LIKE",
            "Listar livros atualmente indisponíveis",
          ],
          bonusChallenges: [
            "Contar quantos livros há por autor com GROUP BY",
            "Listar os livros que nunca foram emprestados",
          ],
          successCriteria: [
            "Todas as consultas rodam sem erro em um banco recém-criado a partir dos scripts",
            "Cada consulta tem um comentário com a pergunta que responde",
            "Os resultados conferem com uma contagem manual feita sobre os dados inseridos",
          ],
          suggestedStructure: "biblioteca-sql/\n├── schema.sql\n├── dados.sql\n├── consultas.sql\n└── README.md",
          suggestedReadme:
            "# Consultas em um Banco de Biblioteca\n\nExercícios de SQL sobre um acervo de livros.\n\n## Como rodar\n```\nsqlite3 biblioteca.db < schema.sql\nsqlite3 biblioteca.db < dados.sql\nsqlite3 biblioteca.db < consultas.sql\n```\n\n## Perguntas respondidas\n- Livros publicados depois de 2000\n- Os 5 livros mais antigos",
          futureImprovements: [
            "Adicionar a tabela de leitores e relacioná-la aos empréstimos",
            "Criar uma view com os livros disponíveis",
          ],
        },
        {
          languageId: sql.id,
          slug: "modelagem-loja",
          title: "Modelagem de uma Loja Online",
          level: ProjectLevel.INTERMEDIATE,
          order: 2,
          objective:
            "Praticar modelagem relacional (PK, FK, restrições), JOINs e agregações construindo o banco de uma loja do zero.",
          problem:
            "Um banco mal modelado gera consultas lentas e dados inconsistentes. Este projeto força você a decidir quais tabelas existem, " +
            "como se relacionam e como impedir dados inválidos.",
          stack: "PostgreSQL (ou SQLite) + scripts .sql",
          requirements: [
            "Criar as tabelas clientes, produtos, pedidos e itens_pedido com CREATE TABLE",
            "Definir chaves primárias, chaves estrangeiras e ao menos uma restrição NOT NULL, UNIQUE ou CHECK",
            "Inserir dados de exemplo: 10 clientes, 20 produtos e 30 pedidos",
            "Escrever consultas com INNER JOIN e LEFT JOIN (ex.: pedidos com o nome do cliente; clientes sem pedidos)",
            "Calcular o total de cada pedido e o faturamento por cliente com SUM e GROUP BY",
          ],
          features: [
            "Relatório dos 5 produtos mais vendidos",
            "Lista de clientes que nunca compraram",
          ],
          bonusChallenges: [
            "Adicionar índices e comparar o plano de execução com EXPLAIN",
            "Registrar o estoque e impedir estoque negativo com CHECK",
          ],
          successCriteria: [
            "Não é possível inserir um pedido para um cliente inexistente (a FK bloqueia)",
            "O faturamento total por cliente bate com um cálculo manual",
            "Os scripts recriam o banco inteiro do zero, em ordem, sem erro",
          ],
          suggestedStructure:
            "loja-sql/\n├── 01_schema.sql\n├── 02_dados.sql\n├── 03_consultas.sql\n└── README.md",
          suggestedReadme:
            "# Modelagem de uma Loja Online\n\nBanco relacional de uma loja com clientes, produtos e pedidos.\n\n## Modelo\nclientes 1—N pedidos 1—N itens_pedido N—1 produtos\n\n## Como rodar\nExecute os scripts na ordem numerada.",
          futureImprovements: [
            "Adicionar a tabela de categorias e relacionar com produtos",
            "Expor os relatórios como uma API que consome este banco",
          ],
        },
        {
          languageId: sql.id,
          slug: "relatorios-vendas",
          title: "Relatórios Analíticos de Vendas",
          level: ProjectLevel.ADVANCED,
          order: 3,
          objective:
            "Praticar consultas analíticas: subconsultas, CTEs, views e agregações sobre um histórico de vendas.",
          problem:
            "Times de negócio pedem relatórios que cruzam várias tabelas, comparam períodos e ranqueiam resultados. " +
            "Este projeto simula esse trabalho e cobra consultas legíveis, não só corretas.",
          stack: "PostgreSQL (recomendado, por causa de CTEs e funções de janela)",
          requirements: [
            "Partir do banco de vendas (ou da loja online) com ao menos 200 pedidos distribuídos em 12 meses",
            "Relatório de faturamento mensal com GROUP BY e ordenação cronológica",
            "Ranking dos 10 clientes que mais compraram, usando subconsulta ou CTE",
            "Listar clientes com faturamento acima da média geral (subconsulta com AVG)",
            "Criar ao menos 2 views reutilizáveis para os relatórios mais usados",
          ],
          features: [
            "Variação percentual de faturamento entre meses consecutivos",
            "Produtos que representam 80% do faturamento (curva ABC)",
          ],
          bonusChallenges: [
            "Reescrever um dos relatórios com funções de janela (RANK, SUM OVER)",
            "Comparar o desempenho antes e depois de criar índices, com EXPLAIN ANALYZE",
          ],
          successCriteria: [
            "Os totais dos relatórios batem com uma conferência feita por consulta simples",
            "Nenhum relatório depende de ordem implícita: toda ordenação usa ORDER BY",
            "As consultas complexas estão divididas em CTEs nomeadas e comentadas",
          ],
          suggestedStructure:
            "relatorios-sql/\n├── schema.sql\n├── dados.sql\n├── views.sql\n├── relatorios/\n│   ├── faturamento_mensal.sql\n│   └── top_clientes.sql\n└── README.md",
          suggestedReadme:
            "# Relatórios Analíticos de Vendas\n\nConsultas analíticas sobre um histórico de vendas.\n\n## Relatórios\n- Faturamento mensal\n- Top 10 clientes\n- Clientes acima da média\n\n## Como rodar\nExecute `schema.sql`, `dados.sql`, `views.sql` e depois cada relatório.",
          futureImprovements: [
            "Automatizar a geração dos relatórios em CSV com um script",
            "Montar um dashboard em cima das views",
          ],
        },
      ],
    });
  }
}

// ── Fase 6: catálogo de conquistas (global, não por linguagem) ───────────

async function seedAchievements() {
  await prisma.achievement.createMany({
    data: [
      {
        slug: "primeira-vitoria",
        name: "Primeira Vitória",
        description: "Resolveu o primeiro exercício corretamente.",
        xpReward: 20,
      },
      {
        slug: "diagnostico-completo",
        name: "Autoconhecimento",
        description: "Completou um diagnóstico de linguagem.",
        xpReward: 30,
      },
      {
        slug: "sequencia-3-dias",
        name: "Constância",
        description: "Praticou por 3 dias seguidos.",
        xpReward: 50,
      },
      {
        slug: "primeiro-projeto",
        name: "Primeiro Projeto",
        description: "Concluiu o primeiro projeto de portfólio.",
        xpReward: 100,
      },
    ],
    skipDuplicates: true,
  });
}

async function main() {
  await seedPython();
  await seedSql();
  await seedAchievements();

  // eslint-disable-next-line no-console
  console.log(
    "Seed concluído: linguagens (Python e SQL), cursos, módulos, aulas, exercícios, diagnóstico, projetos e conquistas."
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
