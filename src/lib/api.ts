"use client";
import { browserClient } from "@/lib/supabase/browser";

// Typed wrappers for the database functions (see supabase/migrations). All grading happens there.

export type Stats = { pct: number; n: number } | null;

export type QuizItem = {
  position: number;
  qid: string;
  topic: string | null;
  stem: string;
  options: string[];
  chosen: number | null;
  // present once revealed (instant mode after answering, or after finishing)
  correct?: boolean;
  correct_pos?: number;
  explanation?: string;
  stats?: Stats;
  changed?: boolean;
};

export type Quiz = {
  id: string;
  scope: string;
  title: string;
  feedback_mode: "instant" | "end";
  status: "in_progress" | "completed" | "abandoned";
  score: number | null;
  answered: number | null;
  total: number;
  items: QuizItem[];
};

export type ExamState =
  | { id: string; status: "submitted" | "expired" }
  | {
      id: string;
      status: "in_progress";
      set_id: string;
      set_name: string;
      started_at: string;
      ends_at: string;
      server_now: string;
      current_index: number;
      view: "item" | "review";
      items: { pos: number; stem: string; options: string[]; select_count: number; chosen: number[]; flagged: boolean }[];
    };

export type ExamResult = {
  id: string;
  set_id: string;
  set_name: string;
  status: "submitted" | "expired";
  finished_at: string;
  time_used_sec: number;
  correct: number;
  total: number;
  scaled: number;
  passed: boolean;
  pass_score: number;
  domains: { id: string; name: string; weight: number; right: number; total: number }[];
  items: {
    pos: number; qid: string; domain: string; stem: string; options: string[]; select_count: number;
    chosen: number[]; correct_pos: number[]; correct: boolean; flagged: boolean; explanation: string; stats: Stats; changed: boolean;
  }[];
};

export type Dashboard = {
  server_now: string;
  is_anonymous: boolean;
  profile: {
    exam_date: string | null;
    feedback_mode: "instant" | "end";
    last_note_page: string | null;
    signin_prompt_dismissed_at: string | null;
  };
  todos: { id: number; label: string; done: boolean }[];
  studied: Record<string, string>;
  modules: {
    id: string; slug: string; title: string; minutes: number; question_count: number;
    tries: number | null; best: number | null; last: number | null;
  }[];
  results: { right: number; mistakes: number; total: number };
  weak_topics: { module_id: string; topic: string; slug: string }[];
  has_completed_quiz: boolean;
  recent: { id: string; title: string; scope: string; status: string; finished_at: string; score: number; answered: number; total: number }[];
  exam: {
    blueprint: { id: string; title: string; items: number; minutes: number; pass_score: number; domain_count: number } | null;
    sets: { id: string; name: string; tries: number; best: number | null; last: number | null }[];
    history: { id: string; set_id: string | null; set_name: string; status: string; finished_at: string; correct: number; total: number; scaled: number; passed: boolean }[];
    weakest: { name: string; pct: number }[];
    in_progress: { id: string; set_id: string; set_name: string; ends_at: string; view: string; total: number; answered: number } | null;
  };
};

const MESSAGES: Record<string, string> = {
  not_signed_in: "Your session ended. Please reload the page.",
  rate_limited: "Too many requests. Please wait a little and try again.",
  no_questions: "There are no questions for this right now.",
  already_answered: "That question was already answered.",
  too_many_todos: "You can have up to 50 to-dos.",
};

export function friendlyError(message: string): string {
  const key = Object.keys(MESSAGES).find((k) => message.includes(k));
  return key ? MESSAGES[key] : message;
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await browserClient().rpc(fn, args);
  if (error) throw new Error(friendlyError(error.message));
  return data as T;
}

export const api = {
  dashboard: () => call<Dashboard>("my_dashboard"),
  startQuiz: (scope: string, retryOf?: string) => call<Quiz>("start_quiz", { p_scope: scope, p_retry_of: retryOf ?? null }),
  getQuiz: (id: string) => call<Quiz>("get_quiz", { p_attempt: id }),
  answerQuiz: (id: string, position: number, choice: number) =>
    call<QuizItem | { position: number; chosen: number }>("answer_quiz", { p_attempt: id, p_position: position, p_choice: choice }),
  finishQuiz: (id: string, completed: boolean) => call<Quiz | { deleted: true }>("finish_quiz", { p_attempt: id, p_completed: completed }),
  startExam: (set: string) => call<{ attempt_id: string; resumed: boolean }>("start_exam", { p_set: set }),
  getExam: (id: string) => call<ExamState>("get_exam", { p_attempt: id }),
  saveExam: (
    id: string,
    change: { position?: number; chosen?: number[]; flagged?: boolean; currentIndex?: number; view?: "item" | "review" },
  ) =>
    call<{ status: string; server_now?: string }>("save_exam_item", {
      p_attempt: id,
      p_position: change.position ?? null,
      p_chosen: change.chosen ?? null,
      p_flagged: change.flagged ?? null,
      p_current_index: change.currentIndex ?? null,
      p_view: change.view ?? null,
    }),
  submitExam: (id: string) => call<{ status: string }>("submit_exam", { p_attempt: id }),
  discardExam: (id: string) => call<{ discarded: boolean }>("discard_exam", { p_attempt: id }),
  examResult: (id: string) => call<ExamResult>("get_exam_result", { p_attempt: id }),
  report: (qid: string, reason: string, details: string) =>
    call<{ ok: boolean; duplicate: boolean }>("report_question", { p_qid: qid, p_reason: reason, p_details: details }),
  exportData: () => call<unknown>("export_my_data"),
  deleteAccount: () => call<{ deleted: boolean }>("delete_my_account"),
};

export const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
export const pctClass = (p: number) => (p >= 75 ? "good" : p < 60 ? "bad" : "");
