-- Module quizzes, graded on the server. Clients see option texts in a per-attempt shuffled
-- order and answer with positions; option ids and answer keys never leave the database
-- until an item is revealed (instant mode) or the quiz is finished.

create function private.ordered_options(p_options jsonb, p_order text[]) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(o ->> 'text' order by array_position(p_order, o ->> 'id')), '[]'::jsonb)
    from jsonb_array_elements(p_options) o
$$;

create function private.positions(p_order text[], p_ids text[]) returns int[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(array_position(p_order, x) - 1 order by array_position(p_order, x)), '{}')
    from unnest(p_ids) x
$$;

-- Latest graded answer per module question for a user ("questions right on your latest try").
create function private.latest_module_results(p_user uuid)
returns table (question_id text, correct boolean)
language sql stable security definer set search_path = '' as $$
  select distinct on (i.question_id) i.question_id, i.correct
    from public.quiz_items i
    join public.quiz_attempts a on a.id = i.attempt_id
   where a.user_id = p_user and i.correct is not null
   order by i.question_id, i.answered_at desc
$$;

create function private.quiz_payload(p_attempt uuid, p_finished boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id, 'scope', a.scope, 'title', a.title, 'feedback_mode', a.feedback_mode, 'status', a.status,
    'started_at', a.started_at, 'finished_at', a.finished_at, 'score', a.score, 'answered', a.answered,
    'total', a.total,
    'items', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'position', i.position,
          'qid', q.id,
          'topic', t.title,
          'stem', q.stem,
          'options', private.ordered_options(q.options, i.option_order),
          'chosen', array_position(i.option_order, i.chosen) - 1
        ) || case when p_finished or (a.feedback_mode = 'instant' and i.chosen is not null) then
          jsonb_build_object(
            'correct', coalesce(i.correct, false),
            'correct_pos', array_position(i.option_order, k.answer[1]) - 1,
            'explanation', k.explanation,
            'stats', private.stats_for(q.id, i.question_rev),
            'changed', q.rev <> i.question_rev)
          else '{}'::jsonb end
        order by i.position), '[]'::jsonb)
        from public.quiz_items i
        join public.questions q on q.id = i.question_id
        left join public.topics t on t.id = q.topic_id
        join private.answer_keys k on k.question_id = q.id
       where i.attempt_id = a.id)
  )
  from public.quiz_attempts a where a.id = p_attempt
$$;

-- scope: 'module:<id>' | 'mixed' | 'mistakes' | 'retry' (with p_retry_of)
create function public.start_quiz(p_scope text, p_retry_of uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.uid();
  v_ids text[];
  v_title text;
  v_mode text;
  v_id uuid;
begin
  perform private.rate_limit(v_user, 'quiz_start', 120, interval '1 hour');
  select feedback_mode into v_mode from public.profiles where user_id = v_user;

  if p_scope like 'module:%' then
    select title into v_title from public.modules where id = substr(p_scope, 8);
    if v_title is null then raise exception 'unknown_module'; end if;
    select array_agg(id) into v_ids from public.questions
     where kind = 'module' and module_id = substr(p_scope, 8) and retired_at is null;
  elsif p_scope = 'mixed' then
    v_title := 'Mixed quiz';
    select array_agg(id) into v_ids from public.questions where kind = 'module' and retired_at is null;
  elsif p_scope = 'mistakes' then
    v_title := 'Mistakes review';
    select array_agg(r.question_id) into v_ids
      from private.latest_module_results(v_user) r
      join public.questions q on q.id = r.question_id
     where not r.correct and q.retired_at is null;
  elsif p_scope = 'retry' then
    v_title := 'Retry missed';
    select array_agg(i.question_id) into v_ids
      from public.quiz_items i
      join public.quiz_attempts a on a.id = i.attempt_id
      join public.questions q on q.id = i.question_id
     where a.id = p_retry_of and a.user_id = v_user and not coalesce(i.correct, false) and q.retired_at is null;
  else
    raise exception 'bad_scope';
  end if;

  if coalesce(cardinality(v_ids), 0) = 0 then raise exception 'no_questions'; end if;
  v_ids := (private.shuffled(v_ids))[1:100];

  insert into public.quiz_attempts (user_id, scope, title, feedback_mode, total, content_release_id)
  values (v_user, p_scope, v_title, coalesce(v_mode, 'instant'), cardinality(v_ids), private.latest_release())
  returning id into v_id;

  insert into public.quiz_items (attempt_id, position, question_id, question_rev, option_order)
  select v_id, u.ord - 1, q.id, q.rev,
         private.shuffled(array(select o ->> 'id' from jsonb_array_elements(q.options) o))
    from unnest(v_ids) with ordinality as u(qid, ord)
    join public.questions q on q.id = u.qid;

  return private.quiz_payload(v_id, false);
end $$;

create function public.get_quiz(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.uid(); v_status text;
begin
  select status into v_status from public.quiz_attempts where id = p_attempt and user_id = v_user;
  if v_status is null then raise exception 'not_found'; end if;
  return private.quiz_payload(p_attempt, v_status <> 'in_progress');
end $$;

-- Instant mode: grade now and reveal (one answer only). End mode: save; may be changed until finish.
create function public.answer_quiz(p_attempt uuid, p_position int, p_choice int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.uid();
  a public.quiz_attempts;
  it public.quiz_items;
  v_opt text;
  v_ok boolean;
begin
  select * into a from public.quiz_attempts where id = p_attempt and user_id = v_user for update;
  if not found then raise exception 'not_found'; end if;
  if a.status <> 'in_progress' then raise exception 'finished'; end if;
  select * into it from public.quiz_items where attempt_id = p_attempt and position = p_position;
  if not found then raise exception 'bad_position'; end if;
  if p_choice is null or p_choice < 0 or p_choice >= cardinality(it.option_order) then raise exception 'bad_choice'; end if;
  v_opt := it.option_order[p_choice + 1];

  if a.feedback_mode = 'instant' then
    if it.chosen is not null then raise exception 'already_answered'; end if;
    select v_opt = any (k.answer) into v_ok from private.answer_keys k where k.question_id = it.question_id;
    update public.quiz_items set chosen = v_opt, correct = v_ok, answered_at = now()
     where attempt_id = p_attempt and position = p_position;
    perform private.record_answer(v_user, it.question_id, it.question_rev, v_ok);
    return (select e from jsonb_array_elements(private.quiz_payload(p_attempt, false) -> 'items') e
             where (e ->> 'position')::int = p_position);
  end if;

  update public.quiz_items set chosen = v_opt, answered_at = now()
   where attempt_id = p_attempt and position = p_position;
  return jsonb_build_object('position', p_position, 'chosen', p_choice);
end $$;

-- Finish (completed) or stop early (abandoned). Grades any ungraded answers, returns the full review.
create function public.finish_quiz(p_attempt uuid, p_completed boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.uid();
  a public.quiz_attempts;
  r record;
  v_answered int;
  v_score int;
begin
  select * into a from public.quiz_attempts where id = p_attempt and user_id = v_user for update;
  if not found then raise exception 'not_found'; end if;
  if a.status <> 'in_progress' then return private.quiz_payload(p_attempt, true); end if;

  for r in
    select i.position, i.question_id, i.question_rev, (i.chosen = any (k.answer)) as ok
      from public.quiz_items i join private.answer_keys k on k.question_id = i.question_id
     where i.attempt_id = p_attempt and i.chosen is not null and i.correct is null
  loop
    update public.quiz_items set correct = r.ok where attempt_id = p_attempt and position = r.position;
    perform private.record_answer(v_user, r.question_id, r.question_rev, r.ok);
  end loop;

  select count(*) filter (where chosen is not null), count(*) filter (where correct)
    into v_answered, v_score from public.quiz_items where attempt_id = p_attempt;

  if v_answered = 0 and not p_completed then
    delete from public.quiz_attempts where id = p_attempt;
    return jsonb_build_object('deleted', true);
  end if;

  update public.quiz_attempts
     set status = case when p_completed then 'completed' else 'abandoned' end,
         finished_at = now(), score = v_score, answered = v_answered
   where id = p_attempt;
  return private.quiz_payload(p_attempt, true);
end $$;

revoke all on function public.start_quiz(text, uuid), public.get_quiz(uuid),
  public.answer_quiz(uuid, int, int), public.finish_quiz(uuid, boolean) from public, anon;
grant execute on function public.start_quiz(text, uuid), public.get_quiz(uuid),
  public.answer_quiz(uuid, int, int), public.finish_quiz(uuid, boolean) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
