-- Dashboard data, topic progress, question reports, account export/delete, and merging a
-- guest (anonymous) user's progress into an existing account.

create function public.my_dashboard() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.uid();
  v_bp text := (select id from public.blueprints where active);
  v_current uuid;
begin
  select id into v_current from public.exam_attempts where user_id = v_user and status = 'in_progress';
  if v_current is not null then
    perform private.expire_if_due(v_current);
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'is_anonymous', coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false),
    'profile', (select to_jsonb(p) - 'user_id' from public.profiles p where p.user_id = v_user),
    'todos', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'label', t.label, 'done', t.done)
                order by t.position, t.id), '[]'::jsonb) from public.todos t where t.user_id = v_user),
    'studied', (select coalesce(jsonb_object_agg(module_id, studied_at), '{}'::jsonb)
                  from public.module_progress where user_id = v_user),
    'modules', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', m.id, 'slug', m.slug, 'title', m.title, 'minutes', m.minutes,
                  'question_count', m.question_count,
                  'tries', s.tries, 'best', s.best, 'last', s.last) order by m.position), '[]'::jsonb)
                  from public.modules m
                  left join lateral (
                    select count(*) as tries,
                           max(round(100.0 * score / nullif(total, 0))) as best,
                           (array_agg(round(100.0 * score / nullif(total, 0)) order by finished_at desc))[1] as last
                      from public.quiz_attempts
                     where user_id = v_user and scope = 'module:' || m.id and status = 'completed'
                  ) s on s.tries > 0),
    'results', (select jsonb_build_object(
                  'right', count(*) filter (where r.correct),
                  'mistakes', count(*) filter (where not r.correct),
                  'total', (select count(*) from public.questions where kind = 'module' and retired_at is null))
                  from private.latest_module_results(v_user) r
                  join public.questions q on q.id = r.question_id and q.retired_at is null),
    'weak_topics', (select coalesce(jsonb_agg(distinct jsonb_build_object(
                      'module_id', t.module_id, 'topic', t.title, 'slug', t.slug)), '[]'::jsonb)
                      from private.latest_module_results(v_user) r
                      join public.questions q on q.id = r.question_id and q.retired_at is null
                      join public.topics t on t.id = q.topic_id
                     where not r.correct),
    'has_completed_quiz', exists (select 1 from public.quiz_attempts where user_id = v_user and status = 'completed'),
    'recent', (select coalesce(jsonb_agg(x order by x.finished_at desc), '[]'::jsonb) from (
                 select id, title, scope, status, finished_at, score, answered, total
                   from public.quiz_attempts
                  where user_id = v_user and status <> 'in_progress'
                  order by finished_at desc limit 6) x),
    'exam', jsonb_build_object(
      'blueprint', (select jsonb_build_object('id', b.id, 'title', b.title, 'items', b.items, 'minutes', b.minutes,
                      'pass_score', b.pass_score, 'domain_count', (select count(*) from public.domains where blueprint_id = b.id))
                      from public.blueprints b where b.id = v_bp),
      'sets', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', s.id, 'name', s.name,
                 'tries', (select count(*) from public.exam_attempts e where e.user_id = v_user and e.set_id = s.id and e.status <> 'in_progress'),
                 'best', (select max(scaled) from public.exam_attempts e where e.user_id = v_user and e.set_id = s.id and e.status <> 'in_progress'),
                 'last', (select scaled from public.exam_attempts e where e.user_id = v_user and e.set_id = s.id and e.status <> 'in_progress'
                           order by finished_at desc limit 1)) order by s.position), '[]'::jsonb)
                 from public.exam_sets s where s.blueprint_id = v_bp),
      'history', (select coalesce(jsonb_agg(x order by x.finished_at desc), '[]'::jsonb) from (
                    select id, set_id, set_name, status, finished_at, correct, total, scaled, passed
                      from public.exam_attempts where user_id = v_user and status <> 'in_progress'
                     order by finished_at desc limit 3) x),
      'weakest', (select coalesce(jsonb_agg(w order by w.pct), '[]'::jsonb) from (
                    select d.name, round(100.0 * (e.domain_scores -> d.id ->> 'right')::int
                                         / nullif((e.domain_scores -> d.id ->> 'total')::int, 0)) as pct
                      from (select * from public.exam_attempts where user_id = v_user and status <> 'in_progress'
                             order by finished_at desc limit 1) e
                      join public.domains d on d.blueprint_id = e.blueprint_id and e.domain_scores ? d.id
                     order by 2 limit 2) w where w.pct < 75),
      'in_progress', (select jsonb_build_object('id', e.id, 'set_id', coalesce(e.set_id, 'mixed'), 'set_name', e.set_name,
                        'ends_at', e.ends_at, 'view', e.view, 'total', e.total,
                        'answered', (select count(*) from public.exam_items i
                                      where i.attempt_id = e.id and cardinality(i.chosen) = i.select_count))
                        from public.exam_attempts e where e.user_id = v_user and e.status = 'in_progress'))
  );
end $$;

-- Per-topic quiz progress for one module's notes page, with the questions currently missed.
create function public.my_topic_progress(p_module text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.uid();
begin
  return (
    select coalesce(jsonb_object_agg(x.slug, x.data), '{}'::jsonb)
      from (
        select t.slug, jsonb_build_object(
          'total', count(q.id),
          'seen', count(r.question_id),
          'right', count(*) filter (where r.correct),
          'misses', coalesce(jsonb_agg(jsonb_build_object(
                      'qid', q.id, 'stem', q.stem,
                      'answer', (select o ->> 'text' from jsonb_array_elements(q.options) o where o ->> 'id' = k.answer[1]),
                      'explanation', k.explanation)) filter (where r.correct = false), '[]'::jsonb)) as data
          from public.topics t
          left join public.questions q on q.topic_id = t.id and q.retired_at is null
          left join private.latest_module_results(v_user) r on r.question_id = q.id
          left join private.answer_keys k on k.question_id = q.id
         where t.module_id = p_module and t.active
         group by t.id, t.slug) x);
end $$;

create function public.report_question(p_qid text, p_reason text, p_details text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.uid(); v_rev int;
begin
  select rev into v_rev from public.questions where id = p_qid;
  if v_rev is null then raise exception 'unknown_question'; end if;
  if exists (select 1 from public.question_reports where user_id = v_user and question_id = p_qid and status = 'open') then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  perform private.rate_limit(v_user, 'report', 20, interval '1 day');
  insert into public.question_reports (user_id, question_id, question_rev, reason, details)
  values (v_user, p_qid, v_rev, p_reason, nullif(trim(p_details), ''));
  return jsonb_build_object('ok', true, 'duplicate', false);
end $$;

create function public.export_my_data() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.uid();
begin
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where user_id = v_user),
    'todos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.todos t where user_id = v_user),
    'studied', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.module_progress m where user_id = v_user),
    'quiz_attempts', (select coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object('items',
                        (select jsonb_agg(jsonb_build_object('question_id', i.question_id, 'chosen', i.chosen, 'correct', i.correct))
                           from public.quiz_items i where i.attempt_id = a.id))), '[]'::jsonb)
                        from public.quiz_attempts a where user_id = v_user),
    'exam_attempts', (select coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object('items',
                        (select jsonb_agg(jsonb_build_object('question_id', i.question_id, 'chosen', i.chosen,
                                                             'correct', i.correct, 'flagged', i.flagged))
                           from public.exam_items i where i.attempt_id = a.id))), '[]'::jsonb)
                        from public.exam_attempts a where user_id = v_user),
    'reports', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.question_reports r where user_id = v_user));
end $$;

create function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.uid();
begin
  delete from auth.users where id = v_user;
  return jsonb_build_object('deleted', true);
end $$;

-- ---------------------------------------------------------------- guest -> existing account merge
-- 1. While still the guest, the app calls create_merge_ticket() and keeps the token in an httpOnly cookie.
-- 2. After signing in to the existing account, it calls claim_merge_ticket(token).

create function public.create_merge_ticket() returns text
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.uid(); v_token text;
begin
  if not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_anonymous';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  delete from private.merge_tickets where anon_user_id = v_user;
  insert into private.merge_tickets (token_hash, anon_user_id, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_user, now() + interval '30 minutes');
  return v_token;
end $$;

create function public.claim_merge_ticket(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.uid();
  t private.merge_tickets;
  v_anon uuid;
  v_inprog uuid;
begin
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'still_anonymous'; end if;
  select * into t from private.merge_tickets
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found or t.used_at is not null or t.expires_at < now() then
    return jsonb_build_object('merged', false, 'reason', 'invalid_ticket');
  end if;
  v_anon := t.anon_user_id;
  if v_anon = v_user or not exists (select 1 from auth.users where id = v_anon and is_anonymous) then
    update private.merge_tickets set used_at = now() where token_hash = t.token_hash;
    return jsonb_build_object('merged', false, 'reason', 'not_a_guest');
  end if;

  -- only one in-progress exam per user: the guest's is submitted if the account already has one
  if exists (select 1 from public.exam_attempts where user_id = v_user and status = 'in_progress') then
    for v_inprog in select id from public.exam_attempts where user_id = v_anon and status = 'in_progress' loop
      perform private.finalize_exam(v_inprog, 'submitted');
    end loop;
  end if;

  update public.quiz_attempts set user_id = v_user where user_id = v_anon;
  update public.exam_attempts set user_id = v_user where user_id = v_anon;
  delete from public.question_reports r where r.user_id = v_anon and r.status = 'open'
     and exists (select 1 from public.question_reports o where o.user_id = v_user and o.question_id = r.question_id and o.status = 'open');
  update public.question_reports set user_id = v_user where user_id = v_anon;

  insert into private.first_answers (user_id, question_id, rev, correct)
  select v_user, question_id, rev, correct from private.first_answers where user_id = v_anon
  on conflict do nothing;
  delete from private.first_answers where user_id = v_anon;

  insert into public.module_progress (user_id, module_id, studied_at)
  select v_user, module_id, studied_at from public.module_progress where user_id = v_anon
  on conflict (user_id, module_id) do update
    set studied_at = least(public.module_progress.studied_at, excluded.studied_at);

  insert into public.todos (user_id, label, done, position)
  select v_user, a.label, a.done, a.position + 100 from public.todos a
   where a.user_id = v_anon
     and not exists (select 1 from public.todos b where b.user_id = v_user and lower(b.label) = lower(a.label))
     and (select count(*) from public.todos where user_id = v_user) < 50;

  update public.profiles p set
    exam_date = coalesce(p.exam_date, g.exam_date),
    last_note_page = coalesce(p.last_note_page, g.last_note_page)
    from public.profiles g where p.user_id = v_user and g.user_id = v_anon;

  update private.merge_tickets set used_at = now() where token_hash = t.token_hash;
  return jsonb_build_object('merged', true);
end $$;

revoke all on function public.my_dashboard(), public.my_topic_progress(text),
  public.report_question(text, text, text), public.export_my_data(), public.delete_my_account(),
  public.create_merge_ticket(), public.claim_merge_ticket(text) from public, anon;
grant execute on function public.my_dashboard(), public.my_topic_progress(text),
  public.report_question(text, text, text), public.export_my_data(), public.delete_my_account(),
  public.create_merge_ticket(), public.claim_merge_ticket(text) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
