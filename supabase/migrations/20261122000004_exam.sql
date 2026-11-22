-- Pearson-style practice exams. The server's ends_at is the only clock that counts:
-- saves after the deadline (plus a short grace) are refused and the attempt is finalized.

-- Mixed exam: per domain, prefer items not seen in the user's earlier exams, then exam-bank
-- items over module questions, then random.
create function private.draw_mixed(p_user uuid, p_bp text) returns text[]
language sql volatile security definer set search_path = '' as $$
  with seen as (
    select distinct i.question_id
      from public.exam_items i join public.exam_attempts a on a.id = i.attempt_id
     where a.user_id = p_user and a.status <> 'in_progress'
  ), ranked as (
    select q.id, q.domain_id,
           row_number() over (
             partition by q.domain_id
             order by (case when s.question_id is not null then 2 else 0 end)
                    + (case when q.kind = 'module' then 1 else 0 end), random()) as rn
      from public.questions q left join seen s on s.question_id = q.id
     where q.retired_at is null and q.domain_id is not null
  )
  select private.shuffled(array_agg(r.id))
    from ranked r join public.domains d on d.blueprint_id = p_bp and d.id = r.domain_id
   where r.rn <= d.item_count
$$;

create function private.finalize_exam(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.exam_attempts;
  r record;
  v_right int;
  v_total int;
  v_dom jsonb;
  v_end timestamptz;
  v_scaled int;
begin
  select * into a from public.exam_attempts where id = p_id for update;
  if not found or a.status <> 'in_progress' then return; end if;

  -- all-or-nothing: the chosen set must equal the answer set; unanswered is wrong
  update public.exam_items i
     set correct = cardinality(i.chosen) > 0
               and (select array_agg(x order by x) from unnest(i.chosen) x)
                 = (select array_agg(x order by x) from unnest(k.answer) x)
    from private.answer_keys k
   where k.question_id = i.question_id and i.attempt_id = p_id;

  for r in select question_id, question_rev, correct from public.exam_items
            where attempt_id = p_id and cardinality(chosen) > 0 loop
    perform private.record_answer(a.user_id, r.question_id, r.question_rev, r.correct);
  end loop;

  select count(*) filter (where correct), count(*) into v_right, v_total
    from public.exam_items where attempt_id = p_id;
  select jsonb_object_agg(domain_id, jsonb_build_object('right', rt, 'total', tt)) into v_dom
    from (select domain_id, count(*) filter (where correct) rt, count(*) tt
            from public.exam_items where attempt_id = p_id group by domain_id) d;

  v_end := least(now(), a.ends_at);
  v_scaled := public.scaled_score(v_right, v_total);
  update public.exam_attempts
     set status = p_status, finished_at = v_end,
         time_used_sec = greatest(0, extract(epoch from v_end - a.started_at))::int,
         correct = v_right, total = v_total, scaled = v_scaled,
         passed = v_scaled >= (select pass_score from public.blueprints where id = a.blueprint_id),
         domain_scores = coalesce(v_dom, '{}'::jsonb)
   where id = p_id;
end $$;

create function private.expire_if_due(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.exam_attempts where id = p_id and status = 'in_progress' and now() > ends_at) then
    perform private.finalize_exam(p_id, 'expired');
  end if;
end $$;

-- p_set: an exam set id ('A', 'B', 'C') or 'mixed'. Returns the in-progress attempt if one exists.
create function public.start_exam(p_set text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.uid();
  v_existing uuid;
  bp public.blueprints;
  v_name text;
  v_ids text[];
  v_id uuid;
begin
  select id into v_existing from public.exam_attempts where user_id = v_user and status = 'in_progress';
  if v_existing is not null then
    perform private.expire_if_due(v_existing);
    if exists (select 1 from public.exam_attempts where id = v_existing and status = 'in_progress') then
      return jsonb_build_object('attempt_id', v_existing, 'resumed', true);
    end if;
  end if;

  select * into bp from public.blueprints where active;
  if not found then raise exception 'no_active_blueprint'; end if;
  perform private.rate_limit(v_user, 'exam_start', 10, interval '1 day');

  if p_set = 'mixed' then
    v_name := 'Mixed exam';
    v_ids := private.draw_mixed(v_user, bp.id);
  else
    select name into v_name from public.exam_sets where blueprint_id = bp.id and id = p_set;
    if v_name is null then raise exception 'unknown_set'; end if;
    select private.shuffled(array_agg(s.question_id)) into v_ids
      from public.exam_set_items s join public.questions q on q.id = s.question_id
     where s.blueprint_id = bp.id and s.set_id = p_set and q.retired_at is null;
  end if;
  if coalesce(cardinality(v_ids), 0) = 0 then raise exception 'no_questions'; end if;

  insert into public.exam_attempts (user_id, blueprint_id, set_id, set_name, ends_at, total, content_release_id)
  values (v_user, bp.id, nullif(p_set, 'mixed'), v_name, now() + make_interval(mins => bp.minutes),
          cardinality(v_ids), private.latest_release())
  returning id into v_id;

  insert into public.exam_items (attempt_id, position, question_id, question_rev, domain_id, option_order, select_count)
  select v_id, u.ord - 1, q.id, q.rev, q.domain_id,
         private.shuffled(array(select o ->> 'id' from jsonb_array_elements(q.options) o)), q.select_count
    from unnest(v_ids) with ordinality as u(qid, ord)
    join public.questions q on q.id = u.qid;

  return jsonb_build_object('attempt_id', v_id, 'resumed', false);
end $$;

-- Exam state for the runner. Expired attempts are finalized on read.
create function public.get_exam(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.uid(); a public.exam_attempts;
begin
  if not exists (select 1 from public.exam_attempts where id = p_attempt and user_id = v_user) then
    raise exception 'not_found';
  end if;
  perform private.expire_if_due(p_attempt);
  select * into a from public.exam_attempts where id = p_attempt;
  if a.status <> 'in_progress' then
    return jsonb_build_object('id', a.id, 'status', a.status);
  end if;
  return jsonb_build_object(
    'id', a.id, 'status', a.status, 'set_id', coalesce(a.set_id, 'mixed'), 'set_name', a.set_name,
    'started_at', a.started_at, 'ends_at', a.ends_at, 'server_now', now(),
    'current_index', a.current_index, 'view', a.view,
    'items', (select jsonb_agg(jsonb_build_object(
                'pos', i.position, 'stem', q.stem,
                'options', private.ordered_options(q.options, i.option_order),
                'select_count', i.select_count,
                'chosen', to_jsonb(private.positions(i.option_order, i.chosen)),
                'flagged', i.flagged) order by i.position)
                from public.exam_items i join public.questions q on q.id = i.question_id
               where i.attempt_id = a.id));
end $$;

-- Save one item (answer and/or flag) and/or the runner position. p_chosen null = leave the answer as is.
create function public.save_exam_item(
  p_attempt uuid, p_position int default null, p_chosen int[] default null, p_flagged boolean default null,
  p_current_index int default null, p_view text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.uid();
  a public.exam_attempts;
  it public.exam_items;
  c int;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = v_user for update;
  if not found then raise exception 'not_found'; end if;
  if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
  if now() > a.ends_at + interval '5 seconds' then
    perform private.finalize_exam(p_attempt, 'expired');
    return jsonb_build_object('status', 'expired');
  end if;

  if p_position is not null then
    select * into it from public.exam_items where attempt_id = p_attempt and position = p_position;
    if not found then raise exception 'bad_position'; end if;
    if p_chosen is not null then
      if cardinality(p_chosen) > it.select_count then raise exception 'too_many_choices'; end if;
      if cardinality(p_chosen) <> (select count(distinct x) from unnest(p_chosen) x) then raise exception 'duplicate_choice'; end if;
      foreach c in array p_chosen loop
        if c is null or c < 0 or c >= cardinality(it.option_order) then raise exception 'bad_choice'; end if;
      end loop;
    end if;
    update public.exam_items
       set chosen = case when p_chosen is null then chosen
                         else array(select it.option_order[x + 1] from unnest(p_chosen) x) end,
           flagged = coalesce(p_flagged, flagged)
     where attempt_id = p_attempt and position = p_position;
  end if;

  if p_view is not null and p_view not in ('item', 'review') then raise exception 'bad_view'; end if;
  if p_current_index is not null and (p_current_index < 0 or p_current_index >= a.total) then raise exception 'bad_index'; end if;
  update public.exam_attempts
     set current_index = coalesce(p_current_index, current_index), view = coalesce(p_view, view)
   where id = p_attempt;
  return jsonb_build_object('status', 'in_progress', 'server_now', now());
end $$;

create function public.submit_exam(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.uid(); a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = v_user;
  if not found then raise exception 'not_found'; end if;
  if a.status = 'in_progress' then
    -- ending at or after the deadline (the client's timer hitting zero) counts as time expired
    perform private.finalize_exam(p_attempt, case when now() >= a.ends_at then 'expired' else 'submitted' end);
  end if;
  return jsonb_build_object('status', (select status from public.exam_attempts where id = p_attempt));
end $$;

create function public.discard_exam(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.uid();
begin
  delete from public.exam_attempts where id = p_attempt and user_id = v_user and status = 'in_progress';
  return jsonb_build_object('discarded', found);
end $$;

create function public.get_exam_result(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.uid(); a public.exam_attempts;
begin
  if not exists (select 1 from public.exam_attempts where id = p_attempt and user_id = v_user) then
    raise exception 'not_found';
  end if;
  perform private.expire_if_due(p_attempt);
  select * into a from public.exam_attempts where id = p_attempt;
  if a.status = 'in_progress' then raise exception 'in_progress'; end if;
  return jsonb_build_object(
    'id', a.id, 'set_id', coalesce(a.set_id, 'mixed'), 'set_name', a.set_name, 'status', a.status,
    'started_at', a.started_at, 'finished_at', a.finished_at, 'time_used_sec', a.time_used_sec,
    'correct', a.correct, 'total', a.total, 'scaled', a.scaled, 'passed', a.passed,
    'pass_score', (select pass_score from public.blueprints where id = a.blueprint_id),
    'domains', (select jsonb_agg(jsonb_build_object(
                  'id', d.id, 'name', d.name, 'weight', d.weight,
                  'right', coalesce((a.domain_scores -> d.id ->> 'right')::int, 0),
                  'total', coalesce((a.domain_scores -> d.id ->> 'total')::int, 0)) order by d.position)
                  from public.domains d
                 where d.blueprint_id = a.blueprint_id and a.domain_scores ? d.id),
    'items', (select jsonb_agg(jsonb_build_object(
                'pos', i.position, 'qid', q.id, 'domain', coalesce(d.name, i.domain_id), 'stem', q.stem,
                'options', private.ordered_options(q.options, i.option_order),
                'select_count', i.select_count,
                'chosen', to_jsonb(private.positions(i.option_order, i.chosen)),
                'correct_pos', to_jsonb(private.positions(i.option_order, k.answer)),
                'correct', coalesce(i.correct, false), 'flagged', i.flagged,
                'explanation', k.explanation,
                'stats', private.stats_for(q.id, i.question_rev),
                'changed', q.rev <> i.question_rev) order by i.position)
                from public.exam_items i
                join public.questions q on q.id = i.question_id
                join private.answer_keys k on k.question_id = q.id
                left join public.domains d on d.blueprint_id = a.blueprint_id and d.id = i.domain_id
               where i.attempt_id = a.id));
end $$;

revoke all on function public.start_exam(text), public.get_exam(uuid),
  public.save_exam_item(uuid, int, int[], boolean, int, text), public.submit_exam(uuid),
  public.discard_exam(uuid), public.get_exam_result(uuid) from public, anon;
grant execute on function public.start_exam(text), public.get_exam(uuid),
  public.save_exam_item(uuid, int, int[], boolean, int, text), public.submit_exam(uuid),
  public.discard_exam(uuid), public.get_exam_result(uuid) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
