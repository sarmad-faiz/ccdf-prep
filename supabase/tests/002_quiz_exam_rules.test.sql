-- Quiz and exam rules: instant-mode lock, all-or-nothing grading, choose-N cap, the server
-- deadline, one exam at a time, first-answer stats. Needs content loaded.
begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'c@test.local', '{}', '{}', now(), now(), false);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

-- instant mode: one answer per question
create temp table q as select public.start_quiz('module:m2') as data;
select lives_ok(format($$select public.answer_quiz(%L, 0, 1)$$, (select data ->> 'id' from q)), 'first answer is accepted');
select throws_ok(format($$select public.answer_quiz(%L, 0, 2)$$, (select data ->> 'id' from q)),
  null, 'already_answered', 'instant mode refuses a second answer');

-- exam: one in progress at a time
create temp table e as select (public.start_exam('A') ->> 'attempt_id')::uuid as id;
select is((public.start_exam('B') ->> 'resumed')::boolean, true, 'starting another exam resumes the running one');
select is((select total from public.exam_attempts where id = (select id from e)), 53, 'exam A has 53 items');

-- choose-N cap is enforced on the server
reset role;
create temp table m as
  select min(position) as first_multi, max(position) as last_multi
    from public.exam_items where attempt_id = (select id from e) and select_count = 2;
grant select on m, e to authenticated;
set local role authenticated;
select throws_ok(
  format($$select public.save_exam_item(%L, %s, array[0,1,2])$$, (select id from e), (select first_multi from m)),
  null, 'too_many_choices', 'more choices than select_count are refused');
select lives_ok(
  format($$select public.save_exam_item(%L, %s, array[0,1], true)$$, (select id from e), (select first_multi from m)),
  'choosing exactly select_count is accepted');
reset role;

-- all-or-nothing grading: answer one multi item fully right and one half right, then finalize
update public.exam_items i set chosen = k.answer
  from private.answer_keys k
 where i.attempt_id = (select id from e) and k.question_id = i.question_id
   and i.position = (select first_multi from m);
update public.exam_items i set chosen = array[k.answer[1]]
  from private.answer_keys k
 where i.attempt_id = (select id from e) and k.question_id = i.question_id
   and i.position = (select last_multi from m);

-- the deadline: past ends_at (beyond the grace) a save finalizes the attempt as expired
update public.exam_attempts set ends_at = now() - interval '1 minute' where id = (select id from e);
set local role authenticated;
select is(
  public.save_exam_item((select id from e), 0, array[0]) ->> 'status', 'expired',
  'a save after the deadline is refused and the exam expires');
reset role;
select is((select status from public.exam_attempts where id = (select id from e)), 'expired', 'attempt is finalized as expired');
select is((select correct from public.exam_items where attempt_id = (select id from e)
            and position = (select first_multi from m)),
          true, 'a fully right multi-response item is correct');
select is((select correct from public.exam_items where attempt_id = (select id from e)
            and position = (select last_multi from m)),
          false, 'a half right multi-response item is wrong');
select is((select count(*)::int from public.exam_items where attempt_id = (select id from e) and correct is null), 0,
          'every item is graded, unanswered ones as wrong');
select is((select scaled from public.exam_attempts where id = (select id from e)),
          public.scaled_score((select correct from public.exam_attempts where id = (select id from e)), 53),
          'scaled score matches the formula');

-- stats count only a user's first answer to a question revision
create temp table before_stats as
  select coalesce((select attempts from private.question_stats where question_id = 'm1-01' and rev = 1), 0) as n;
select private.record_answer('33333333-3333-3333-3333-333333333333', 'm1-01', 1, true);
select private.record_answer('33333333-3333-3333-3333-333333333333', 'm1-01', 1, false);
select is((select attempts from private.question_stats where question_id = 'm1-01' and rev = 1),
          (select n + 1 from before_stats),
          'two answers from the same user add one to the stats');

select * from finish();
rollback;
