-- Content import: the only write path for content tables. Called by scripts/sync-content.ts
-- with the service-role/secret key (never from the browser). Idempotent per content hash.

create function public.import_content(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_release bigint;
  v_bp text := payload -> 'blueprint' ->> 'id';
  v_changed_questions int := 0;
begin
  if exists (select 1 from public.content_releases
              where content_hash = payload -> 'release' ->> 'content_hash') then
    return jsonb_build_object('changed', false, 'release_id', private.latest_release());
  end if;

  -- modules
  insert into public.modules (id, slug, position, title, minutes, lead_md)
  select m ->> 'id', m ->> 'slug', (m ->> 'position')::int, m ->> 'title', (m ->> 'minutes')::int, coalesce(m ->> 'lead_md', '')
    from jsonb_array_elements(payload -> 'modules') m
  on conflict (id) do update set slug = excluded.slug, position = excluded.position, title = excluded.title,
    minutes = excluded.minutes, lead_md = excluded.lead_md;

  -- topics (hidden, not deleted, when removed: retired questions may still point at them)
  insert into public.topics (id, module_id, slug, title, position, body_md, domain_id, active)
  select t ->> 'id', t ->> 'module_id', t ->> 'slug', t ->> 'title', (t ->> 'position')::int, t ->> 'body_md',
         nullif(t ->> 'domain_id', ''), true
    from jsonb_array_elements(payload -> 'topics') t
  on conflict (id) do update set module_id = excluded.module_id, slug = excluded.slug, title = excluded.title,
    position = excluded.position, body_md = excluded.body_md, domain_id = excluded.domain_id, active = true;
  update public.topics set active = false
   where id not in (select t ->> 'id' from jsonb_array_elements(payload -> 'topics') t);

  -- standalone pages (recall)
  insert into public.pages (slug, title, lead_md, sections)
  select p ->> 'slug', p ->> 'title', coalesce(p ->> 'lead_md', ''), p -> 'sections'
    from jsonb_array_elements(payload -> 'pages') p
  on conflict (slug) do update set title = excluded.title, lead_md = excluded.lead_md, sections = excluded.sections;

  -- blueprint + domains
  insert into public.blueprints (id, title, guide, effective_from, items, minutes, pass_score, active)
  values (v_bp, payload -> 'blueprint' ->> 'title', payload -> 'blueprint' ->> 'guide',
          (payload -> 'blueprint' ->> 'effective_from')::date, (payload -> 'blueprint' ->> 'items')::int,
          (payload -> 'blueprint' ->> 'minutes')::int, (payload -> 'blueprint' ->> 'pass_score')::int, true)
  on conflict (id) do update set title = excluded.title, guide = excluded.guide, effective_from = excluded.effective_from,
    items = excluded.items, minutes = excluded.minutes, pass_score = excluded.pass_score, active = true;
  update public.blueprints set active = false where id <> v_bp;

  delete from public.domains where blueprint_id = v_bp
     and id not in (select d ->> 'id' from jsonb_array_elements(payload -> 'domains') d);
  insert into public.domains (blueprint_id, id, name, weight, item_count, position)
  select v_bp, d ->> 'id', d ->> 'name', (d ->> 'weight')::numeric, (d ->> 'item_count')::int, (d ->> 'position')::int
    from jsonb_array_elements(payload -> 'domains') d
  on conflict (blueprint_id, id) do update set name = excluded.name, weight = excluded.weight,
    item_count = excluded.item_count, position = excluded.position;

  -- questions: bump rev when the content hash changes; retire (never delete) removed ones
  with incoming as (
    select q ->> 'id' as id, q ->> 'kind' as kind, nullif(q ->> 'module_id', '') as module_id,
           nullif(q ->> 'topic_id', '') as topic_id, nullif(q ->> 'domain_id', '') as domain_id,
           nullif(q ->> 'objective', '') as objective, q ->> 'stem' as stem, q -> 'options' as options,
           (q ->> 'select_count')::smallint as select_count, q ->> 'content_hash' as content_hash
      from jsonb_array_elements(payload -> 'questions') q
  ), up as (
    insert into public.questions as t (id, kind, module_id, topic_id, domain_id, objective, stem, options,
                                       select_count, rev, content_hash, retired_at)
    select id, kind, module_id, topic_id, domain_id, objective, stem, options, select_count, 1, content_hash, null
      from incoming
    on conflict (id) do update set kind = excluded.kind, module_id = excluded.module_id, topic_id = excluded.topic_id,
      domain_id = excluded.domain_id, objective = excluded.objective, stem = excluded.stem, options = excluded.options,
      select_count = excluded.select_count, content_hash = excluded.content_hash, retired_at = null,
      rev = case when t.content_hash <> excluded.content_hash then t.rev + 1 else t.rev end
    returning 1
  )
  select count(*) into v_changed_questions from up;

  update public.questions set retired_at = now()
   where retired_at is null
     and id not in (select q ->> 'id' from jsonb_array_elements(payload -> 'questions') q);

  insert into private.answer_keys (question_id, answer, explanation)
  select q ->> 'id', array(select jsonb_array_elements_text(q -> 'answer')), q ->> 'explanation'
    from jsonb_array_elements(payload -> 'questions') q
  on conflict (question_id) do update set answer = excluded.answer, explanation = excluded.explanation;

  -- exam sets: replace items
  delete from public.exam_set_items where blueprint_id = v_bp;
  delete from public.exam_sets where blueprint_id = v_bp
     and id not in (select s ->> 'id' from jsonb_array_elements(payload -> 'sets') s);
  insert into public.exam_sets (blueprint_id, id, name, position)
  select v_bp, s ->> 'id', s ->> 'name', (s ->> 'position')::int
    from jsonb_array_elements(payload -> 'sets') s
  on conflict (blueprint_id, id) do update set name = excluded.name, position = excluded.position;
  insert into public.exam_set_items (blueprint_id, set_id, question_id, position)
  select v_bp, s ->> 'id', item.value, item.ordinality::int - 1
    from jsonb_array_elements(payload -> 'sets') s,
         jsonb_array_elements_text(s -> 'items') with ordinality as item(value, ordinality);

  update public.modules m
     set question_count = (select count(*) from public.questions q
                            where q.module_id = m.id and q.kind = 'module' and q.retired_at is null)
   where true;  -- the API's safe-update guard requires a WHERE clause

  insert into public.content_releases (label, git_sha, content_hash)
  values (payload -> 'release' ->> 'label', nullif(payload -> 'release' ->> 'git_sha', ''),
          payload -> 'release' ->> 'content_hash')
  returning id into v_release;

  return jsonb_build_object('changed', true, 'release_id', v_release, 'questions', v_changed_questions);
end $$;

revoke all on function public.import_content(jsonb) from public, anon, authenticated;
grant execute on function public.import_content(jsonb) to service_role;
