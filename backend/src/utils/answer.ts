/**
 * Normaliza uma resposta para comparação: ignora maiúsculas/minúsculas e
 * espaços repetidos ou nas pontas. Usada por exercícios e diagnóstico.
 */
export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function answersMatch(given: string, expected: string): boolean {
  return normalizeAnswer(given) === normalizeAnswer(expected);
}
