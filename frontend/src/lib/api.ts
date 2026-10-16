const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

// Nota de segurança: os tokens ficam no localStorage por simplicidade. Isso os
// expõe a qualquer XSS — o React escapa o conteúdo por padrão e não usamos
// dangerouslySetInnerHTML, mas para produção considere cookies httpOnly + CSRF.

interface AuthResult {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

function getAccessToken() {
  return localStorage.getItem("accessToken");
}

function getRefreshToken() {
  return localStorage.getItem("refreshToken");
}

function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

async function parseJsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "Erro inesperado.");
  }
  return data;
}

export async function register(email: string, password: string, name: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const data: AuthResult = await parseJsonOrThrow(res);
  saveTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data: AuthResult = await parseJsonOrThrow(res);
  saveTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  clearTokens();
}

// Renovação de token compartilhada: várias requisições paralelas que recebem 401
// ao mesmo tempo devem disparar UM único refresh. Como o refresh token é rotacionado
// (o antigo é revogado), refreshes paralelos fariam os demais falharem e a sessão cair.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data: AuthResult = await res.json();
      saveTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/**
 * fetch autenticado: injeta o access token e, se expirado (401), renova uma vez
 * (compartilhando a renovação entre chamadas concorrentes) e repete a requisição.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = () => {
    const token = getAccessToken();
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  const res = await doFetch();
  if (res.status !== 401) return res;

  const refreshed = await refreshTokens();
  if (!refreshed) {
    clearTokens();
    return res;
  }

  return doFetch();
}

export async function getMe() {
  const res = await authFetch("/users/me");
  return parseJsonOrThrow(res);
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

// ── Fase 2: conteúdo, exercícios e progresso ─────────────────────────

export interface Language {
  id: string;
  slug: string;
  name: string;
  description: string;
  courses: { id: string; slug: string; title: string; description: string; order: number }[];
}

export interface ModuleSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  order: number;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  language: { id: string; slug: string; name: string };
  modules: ModuleSummary[];
}

export interface ExerciseSummary {
  id: string;
  type: "MULTIPLE_CHOICE" | "OUTPUT_PREDICTION";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  order: number;
  prompt: string;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  order: number;
}

export interface ModuleDetail {
  id: string;
  title: string;
  description: string;
  minMasteryPercent: number;
  minExercises: number;
  lessons: Lesson[];
  exercises: ExerciseSummary[];
  course: { id: string; title: string; languageId: string };
}

export interface ExerciseDetail {
  id: string;
  moduleId: string;
  type: "MULTIPLE_CHOICE" | "OUTPUT_PREDICTION";
  difficulty: string;
  prompt: string;
  starterCode: string | null;
  options: { id: string; text: string }[] | null;
  hint: string | null;
}

export interface SubmitResult {
  isCorrect: boolean;
  attempts: number;
  feedback: { level: "correct" | "hint" | "explanation"; message: string; explanation?: string };
  explanation?: string;
}

export interface ModuleProgress {
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  languageId: string;
  languageName: string;
  totalExercises: number;
  solvedExercises: number;
  masteryPercent: number;
  minMasteryPercent: number;
  minExercises: number;
  completed: boolean;
}

export async function listLanguages(): Promise<Language[]> {
  const res = await authFetch("/languages");
  return parseJsonOrThrow(res);
}

export async function getCourse(courseId: string): Promise<Course> {
  const res = await authFetch(`/courses/${courseId}`);
  return parseJsonOrThrow(res);
}

export async function getModule(moduleId: string): Promise<ModuleDetail> {
  const res = await authFetch(`/modules/${moduleId}`);
  return parseJsonOrThrow(res);
}

export async function getExercise(exerciseId: string): Promise<ExerciseDetail> {
  const res = await authFetch(`/exercises/${exerciseId}`);
  return parseJsonOrThrow(res);
}

export async function submitExercise(exerciseId: string, answer: string): Promise<SubmitResult> {
  const res = await authFetch(`/exercises/${exerciseId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer }),
  });
  return parseJsonOrThrow(res);
}

export async function getProgress(): Promise<ModuleProgress[]> {
  const res = await authFetch("/progress");
  return parseJsonOrThrow(res);
}

// ── Fase 3: diagnóstico adaptativo ────────────────────────────────────

export interface DiagnosticQuestion {
  attemptId: string;
  status: "in_progress";
  skill: { id: string; name: string; tier: number };
  progress: { currentSkillIndex: number; totalSkills: number };
  question: {
    id: string;
    type: "MULTIPLE_CHOICE" | "OUTPUT_PREDICTION";
    difficulty: string;
    prompt: string;
    starterCode: string | null;
    options: { id: string; text: string }[] | null;
  };
}

export interface DiagnosticAnswerResult {
  status: "in_progress" | "ready_to_finish";
  wasCorrect: boolean;
  skill?: DiagnosticQuestion["skill"];
  progress?: DiagnosticQuestion["progress"];
  question?: DiagnosticQuestion["question"];
}

export interface DiagnosticResult {
  level: "Iniciante" | "Intermediário" | "Avançado";
  skills: { name: string; tier: number; masteryPercent: number }[];
  strengths: string[];
  gaps: string[];
  stoppedEarly: boolean;
  recommendation: { moduleId: string; moduleTitle: string } | null;
}

export interface UserSkillItem {
  skillId: string;
  name: string;
  tier: number;
  masteryPercent: number;
  languageId: string;
  languageName: string;
}

export type StartAssessmentResult = DiagnosticQuestion | { status: "ready_to_finish"; attemptId: string };

export async function startAssessment(languageId: string): Promise<StartAssessmentResult> {
  const res = await authFetch("/assessments/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ languageId }),
  });
  return parseJsonOrThrow(res);
}

export async function answerAssessment(
  attemptId: string,
  questionId: string,
  answer: string
): Promise<DiagnosticAnswerResult> {
  const res = await authFetch(`/assessments/${attemptId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, answer }),
  });
  return parseJsonOrThrow(res);
}

export async function finishAssessment(attemptId: string): Promise<DiagnosticResult> {
  const res = await authFetch(`/assessments/${attemptId}/finish`, { method: "POST" });
  return parseJsonOrThrow(res);
}

export async function getUserSkills(): Promise<UserSkillItem[]> {
  const res = await authFetch("/skills");
  return parseJsonOrThrow(res);
}

// ── Fase 4: execução de código ────────────────────────────────────────

export interface CodeExecution {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "TIMEOUT";
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  timedOut: boolean;
  errorMessage: string | null;
}

export async function executeCode(language: string, code: string, stdin?: string): Promise<{ executionId: string }> {
  const res = await authFetch("/code/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, code, stdin }),
  });
  return parseJsonOrThrow(res);
}

export async function getCodeExecution(executionId: string): Promise<CodeExecution> {
  const res = await authFetch(`/code/execute/${executionId}`);
  return parseJsonOrThrow(res);
}

// ── Fase 5: projetos de portfólio ─────────────────────────────────────

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  language: { id: string; name: string };
}

export interface ProjectDetail extends ProjectSummary {
  objective: string;
  problem: string;
  stack: string;
  requirements: string[];
  features: string[];
  bonusChallenges: string[] | null;
  successCriteria: string[];
  suggestedStructure: string;
  suggestedReadme: string;
  futureImprovements: string[] | null;
}

export interface ProjectProgressItem {
  projectId: string;
  title: string;
  level: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  repoUrl: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await authFetch("/projects");
  return parseJsonOrThrow(res);
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const res = await authFetch(`/projects/${id}`);
  return parseJsonOrThrow(res);
}

export async function getProjectProgress(): Promise<ProjectProgressItem[]> {
  const res = await authFetch("/projects/progress");
  return parseJsonOrThrow(res);
}

export async function startProject(id: string) {
  const res = await authFetch(`/projects/${id}/start`, { method: "POST" });
  return parseJsonOrThrow(res);
}

export async function completeProject(id: string, repoUrl?: string) {
  const res = await authFetch(`/projects/${id}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl }),
  });
  return parseJsonOrThrow(res);
}

// ── Fase 6: gamificação ────────────────────────────────────────────────

export interface GamificationSummary {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  achievements: {
    slug: string;
    name: string;
    description: string;
    xpReward: number;
    earned: boolean;
    earnedAt: string | null;
  }[];
}

export async function getGamificationSummary(): Promise<GamificationSummary> {
  const res = await authFetch("/gamification/summary");
  return parseJsonOrThrow(res);
}

// ── Fase 7: admin (helper genérico para CRUD de conteúdo) ──────────────

export async function authFetchJson(path: string, method: string, body?: unknown) {
  const res = await authFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  return parseJsonOrThrow(res);
}
