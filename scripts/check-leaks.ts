// End-to-end API check against a running Supabase (local by default):
//  1. a logged-out visitor can read public content but no questions or answers
//  2. a guest can run a quiz and an exam, and NO answer, explanation or option id reaches the
//     client before an item is revealed or the attempt is finished
//  3. results do include answers once finished
// Run: npm run check:leaks
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./supabase-env.ts";

const env = supabaseEnv();
const failures: string[] = [];
const ok = (cond: unknown, msg: string) => {
  if (!cond) failures.push(msg);
};
const leakKeys = ["answer", "explanation", "correct_pos", "explain", "option_order"];
function leaks(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leaks(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      (leakKeys.includes(k) ? [`${path}.${k}`] : []).concat(
        // option objects with ids would let a client map positions back to keys
        k === "options" && Array.isArray(v) && v.some((o) => o && typeof o === "object") ? [`${path}.options has objects`] : [],
        leaks(v, `${path}.${k}`),
      ),
    );
  }
  return [];
}

const anon = createClient(env.url, env.publishableKey, { auth: { persistSession: false } });

// 1. logged-out visitor
{
  const mods = await anon.from("modules").select("id, title, question_count");
  ok(!mods.error && (mods.data?.length ?? 0) > 0, "logged-out visitor should read modules");
  const qs = await anon.from("questions").select("*").limit(1);
  ok(!qs.error ? (qs.data?.length ?? 0) === 0 : true, "logged-out visitor must not read questions");
  const quiz = await anon.rpc("start_quiz", { p_scope: "mixed" });
  ok(quiz.error, "logged-out visitor must not start a quiz");
  const imp = await anon.rpc("import_content", { payload: {} });
  ok(imp.error, "logged-out visitor must not call import_content");
}

// 2. guest
const guest = createClient(env.url, env.publishableKey, { auth: { persistSession: false } });
const signIn = await guest.auth.signInAnonymously();
ok(!signIn.error, `anonymous sign-in failed: ${signIn.error?.message}`);

{
  const qs = await guest.from("questions").select("*").limit(1);
  ok((qs.data?.length ?? 0) === 0, "guest must not select questions directly");
  const keys = await guest.from("quiz_items").select("*").limit(1);
  ok((keys.data?.length ?? 0) === 0, "guest must not select quiz_items directly");
  const imp = await guest.rpc("import_content", { payload: {} });
  ok(imp.error, "guest must not call import_content");

  // end-of-quiz feedback: nothing revealed until finish
  await guest.from("profiles").update({ feedback_mode: "end" }).neq("user_id", "00000000-0000-0000-0000-000000000000");
  const started = await guest.rpc("start_quiz", { p_scope: "module:m1" });
  ok(!started.error, `start_quiz: ${started.error?.message}`);
  ok(leaks(started.data).length === 0, `start_quiz leaks: ${leaks(started.data).join(", ")}`);
  const quiz = started.data;
  for (const item of quiz.items) {
    const r = await guest.rpc("answer_quiz", { p_attempt: quiz.id, p_position: item.position, p_choice: 0 });
    ok(!r.error, `answer_quiz: ${r.error?.message}`);
    ok(leaks(r.data).length === 0, `answer_quiz (end mode) leaks: ${leaks(r.data).join(", ")}`);
  }
  const again = await guest.rpc("get_quiz", { p_attempt: quiz.id });
  ok(leaks(again.data).length === 0, `get_quiz before finish leaks: ${leaks(again.data).join(", ")}`);
  const fin = await guest.rpc("finish_quiz", { p_attempt: quiz.id, p_completed: true });
  ok(!fin.error, `finish_quiz: ${fin.error?.message}`);
  ok(fin.data?.items?.every((i: { explanation?: string }) => i.explanation), "finished quiz should include explanations");
  ok(fin.data?.score === fin.data?.items.filter((i: { correct: boolean }) => i.correct).length, "quiz score should match items");

  // instant feedback: only the answered item is revealed
  await guest.from("profiles").update({ feedback_mode: "instant" }).neq("user_id", "00000000-0000-0000-0000-000000000000");
  const q2 = (await guest.rpc("start_quiz", { p_scope: "mixed" })).data;
  const rev = await guest.rpc("answer_quiz", { p_attempt: q2.id, p_position: 0, p_choice: 1 });
  ok(typeof rev.data?.explanation === "string", "instant mode should reveal the answered item");
  const twice = await guest.rpc("answer_quiz", { p_attempt: q2.id, p_position: 0, p_choice: 2 });
  ok(twice.error, "instant mode must refuse a second answer");
  const after = (await guest.rpc("get_quiz", { p_attempt: q2.id })).data;
  ok(leaks(after.items.slice(1)).length === 0, `unanswered items leak in instant mode: ${leaks(after.items.slice(1)).join(", ")}`);
  await guest.rpc("finish_quiz", { p_attempt: q2.id, p_completed: false });

  // exam
  const ex = await guest.rpc("start_exam", { p_set: "A" });
  ok(!ex.error, `start_exam: ${ex.error?.message}`);
  const state = await guest.rpc("get_exam", { p_attempt: ex.data.attempt_id });
  ok(state.data?.items?.length === 53, "exam A should have 53 items");
  ok(leaks(state.data).length === 0, `get_exam leaks: ${leaks(state.data).join(", ")}`);
  const multi = state.data.items.find((i: { select_count: number }) => i.select_count === 2);
  const tooMany = await guest.rpc("save_exam_item", { p_attempt: ex.data.attempt_id, p_position: multi.pos, p_chosen: [0, 1, 2] });
  ok(tooMany.error, "exam must refuse more choices than select_count");
  for (const item of state.data.items) {
    const chosen = item.select_count === 2 ? [0, 1] : [0];
    const s = await guest.rpc("save_exam_item", { p_attempt: ex.data.attempt_id, p_position: item.pos, p_chosen: chosen, p_flagged: item.pos === 3 });
    ok(!s.error && s.data?.status === "in_progress", `save_exam_item: ${s.error?.message ?? JSON.stringify(s.data)}`);
    ok(leaks(s.data).length === 0, "save_exam_item leaks");
  }
  const early = await guest.rpc("get_exam_result", { p_attempt: ex.data.attempt_id });
  ok(early.error, "results must not be available before the exam ends");
  const sub = await guest.rpc("submit_exam", { p_attempt: ex.data.attempt_id });
  ok(sub.data?.status === "submitted", `submit_exam: ${JSON.stringify(sub.data)}`);
  const res = (await guest.rpc("get_exam_result", { p_attempt: ex.data.attempt_id })).data;
  ok(res?.items?.length === 53 && res.items.every((i: { explanation?: string }) => i.explanation), "exam results include explanations");
  ok(res?.items.some((i: { flagged: boolean }) => i.flagged), "flag should be kept");
  ok(res?.domains?.reduce((s: number, d: { total: number }) => s + d.total, 0) === 53, "domain totals should add to 53");
  const after2 = await guest.rpc("save_exam_item", { p_attempt: ex.data.attempt_id, p_position: 0, p_chosen: [1] });
  ok(after2.data?.status === "submitted", "saves after submit must be refused");

  const dash = await guest.rpc("my_dashboard");
  ok(!dash.error && dash.data.exam.history.length === 1, `my_dashboard: ${dash.error?.message}`);
  ok(dash.data.is_anonymous === true, "dashboard should flag the guest as anonymous");
  const tp = await guest.rpc("my_topic_progress", { p_module: "m1" });
  ok(!tp.error, `my_topic_progress: ${tp.error?.message}`);
  const report = await guest.rpc("report_question", { p_qid: "m1-01", p_reason: "typo", p_details: "check-leaks test" });
  ok(!report.error, `report_question: ${report.error?.message}`);

  await guest.rpc("delete_my_account");
}

if (failures.length) {
  console.error(`check:leaks FAILED (${failures.length}):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("check:leaks OK: no answers, explanations or option ids reach the client before reveal");
