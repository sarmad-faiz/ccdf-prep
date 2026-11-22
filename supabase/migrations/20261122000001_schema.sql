-- ccdf-prep schema: public content, per-user progress, private answer keys.
-- Clients only ever read answer keys through the grading functions in later migrations.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------- content (public read)

create table public.content_releases (
  id bigint generated always as identity primary key,
  label text not null,
  git_sha text,
  content_hash text not null,
  imported_at timestamptz not null default now()
);

create table public.modules (
  id text primary key,                        -- 'm1'
  slug text not null unique,                  -- 'mso-foundations'
  position int not null,
  title text not null,
  minutes int not null,
  lead_md text not null default '',
  question_count int not null default 0
);

create table public.topics (
  id text primary key,                        -- 'm2.tool-use-schemas'
  module_id text not null references public.modules (id),
  slug text not null,
  title text not null,                        -- equals the quiz topic name
  position int not null,
  body_md text not null,
  domain_id text,                             -- exam domain for the mixed exam (null = never drawn)
  active boolean not null default true,
  unique (module_id, slug),
  unique (module_id, title)
);

create table public.pages (
  slug text primary key,                      -- 'recall'
  title text not null,
  lead_md text not null default '',
  sections jsonb not null default '[]'        -- [{slug, title, body_md}]
);

create table public.blueprints (
  id text primary key,                        -- 'ccdvf-2026-07'
  title text not null,
  guide text not null,
  effective_from date,
  items int not null,
  minutes int not null,
  pass_score int not null,
  active boolean not null default false
);

create table public.domains (
  blueprint_id text not null references public.blueprints (id) on delete cascade,
  id text not null,                           -- 'd1'
  name text not null,
  weight numeric not null,
  item_count int not null,
  position int not null,
  primary key (blueprint_id, id)
);

create table public.exam_sets (
  blueprint_id text not null references public.blueprints (id) on delete cascade,
  id text not null,                           -- 'A'
  name text not null,
  position int not null,
  primary key (blueprint_id, id)
);

-- Questions: stems and options only. No client can select these directly; the
-- quiz and exam functions hand out shuffled options without option ids.
create table public.questions (
  id text primary key,
  kind text not null check (kind in ('module', 'exam')),
  module_id text references public.modules (id),
  topic_id text references public.topics (id),
  domain_id text,
  objective text,
  stem text not null,
  options jsonb not null,                     -- [{id, text}]
  select_count smallint not null default 1,
  rev int not null default 1,
  content_hash text not null,
  retired_at timestamptz
);
create index on public.questions (module_id) where retired_at is null;
create index on public.questions (domain_id) where retired_at is null;

create table public.exam_set_items (
  blueprint_id text not null,
  set_id text not null,
  question_id text not null references public.questions (id),
  position int not null,
  primary key (blueprint_id, set_id, question_id),
  foreign key (blueprint_id, set_id) references public.exam_sets (blueprint_id, id) on delete cascade
);

create table private.answer_keys (
  question_id text primary key references public.questions (id) on delete cascade,
  answer text[] not null,
  explanation text not null
);

-- ---------------------------------------------------------------- per user

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  exam_date date,
  feedback_mode text not null default 'instant' check (feedback_mode in ('instant', 'end')),
  last_note_page text check (char_length(last_note_page) <= 80),
  signin_prompt_dismissed_at timestamptz,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.todos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.todos (user_id);

create table public.module_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  module_id text not null references public.modules (id),
  studied_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null,
  title text not null,
  feedback_mode text not null check (feedback_mode in ('instant', 'end')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score int,
  answered int,
  total int not null,
  content_release_id bigint references public.content_releases (id)
);
create index on public.quiz_attempts (user_id, started_at desc);

create table public.quiz_items (
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  position int not null,
  question_id text not null references public.questions (id),
  question_rev int not null,
  option_order text[] not null,
  chosen text,
  correct boolean,
  answered_at timestamptz,
  primary key (attempt_id, position)
);
create index on public.quiz_items (question_id);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  blueprint_id text not null references public.blueprints (id),
  set_id text,                                -- null = mixed
  set_name text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'expired')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  finished_at timestamptz,
  time_used_sec int,
  current_index int not null default 0,
  view text not null default 'item' check (view in ('item', 'review')),
  correct int,
  total int not null,
  scaled int,
  passed boolean,
  domain_scores jsonb,
  content_release_id bigint references public.content_releases (id)
);
create unique index exam_one_in_progress on public.exam_attempts (user_id) where status = 'in_progress';
create index on public.exam_attempts (user_id, started_at desc);

create table public.exam_items (
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  position int not null,
  question_id text not null references public.questions (id),
  question_rev int not null,
  domain_id text not null,
  option_order text[] not null,
  select_count smallint not null,
  chosen text[] not null default '{}',
  flagged boolean not null default false,
  correct boolean,
  primary key (attempt_id, position)
);

create table public.question_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null references public.questions (id),
  question_rev int not null,
  reason text not null check (reason in ('wrong_answer', 'ambiguous', 'typo', 'outdated', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'triaged', 'fixed', 'rejected')),
  created_at timestamptz not null default now()
);
create unique index one_open_report on public.question_reports (user_id, question_id) where status = 'open';

-- Aggregate first-try stats per question revision (kept when anonymous users are cleaned up).
create table private.question_stats (
  question_id text not null references public.questions (id) on delete cascade,
  rev int not null,
  attempts int not null default 0,
  correct int not null default 0,
  primary key (question_id, rev)
);

create table private.first_answers (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null,
  rev int not null,
  correct boolean not null,
  primary key (user_id, question_id, rev)
);

create table private.merge_tickets (
  token_hash text primary key,
  anon_user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table private.rate_events (
  user_id uuid not null,
  kind text not null,
  at timestamptz not null default now()
);
create index on private.rate_events (user_id, kind, at);

-- ---------------------------------------------------------------- row level security

alter table public.content_releases enable row level security;
alter table public.modules enable row level security;
alter table public.topics enable row level security;
alter table public.pages enable row level security;
alter table public.blueprints enable row level security;
alter table public.domains enable row level security;
alter table public.exam_sets enable row level security;
alter table public.questions enable row level security;        -- no policies: functions only
alter table public.exam_set_items enable row level security;   -- no policies: functions only
alter table public.profiles enable row level security;
alter table public.todos enable row level security;
alter table public.module_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_items enable row level security;       -- no policies: functions only
alter table public.exam_attempts enable row level security;
alter table public.exam_items enable row level security;       -- no policies: functions only
alter table public.question_reports enable row level security;

create policy "content is public" on public.content_releases for select to anon, authenticated using (true);
create policy "content is public" on public.modules for select to anon, authenticated using (true);
create policy "content is public" on public.topics for select to anon, authenticated using (active);
create policy "content is public" on public.pages for select to anon, authenticated using (true);
create policy "content is public" on public.blueprints for select to anon, authenticated using (true);
create policy "content is public" on public.domains for select to anon, authenticated using (true);
create policy "content is public" on public.exam_sets for select to anon, authenticated using (true);

create policy "own profile" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own todos" on public.todos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own progress" on public.module_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own quiz attempts" on public.quiz_attempts for select to authenticated using (user_id = (select auth.uid()));
create policy "own exam attempts" on public.exam_attempts for select to authenticated using (user_id = (select auth.uid()));
create policy "own reports" on public.question_reports for select to authenticated using (user_id = (select auth.uid()));

-- Explicit Data API grants (new tables get none by default). RLS above still filters rows.
-- Content and attempt tables are written only by security-definer functions.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.content_releases, public.modules, public.topics, public.pages, public.blueprints,
  public.domains, public.exam_sets to anon, authenticated;
grant select on public.profiles, public.quiz_attempts, public.exam_attempts, public.question_reports to authenticated;
grant select, insert, update, delete on public.todos, public.module_progress to authenticated;
-- Profiles: users may change only their own preferences.
grant update (exam_date, feedback_mode, last_note_page, signin_prompt_dismissed_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------- helpers and triggers

-- Current user, or an error for logged-out callers. Also records activity (used by anonymous cleanup).
create function private.uid() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  update public.profiles set last_active_at = now()
   where user_id = v and last_active_at < now() - interval '5 minutes';
  return v;
end $$;

-- Simple per-user rate limit: at most p_max events of p_kind within p_window.
create function private.rate_limit(p_user uuid, p_kind text, p_max int, p_window interval) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from private.rate_events
       where user_id = p_user and kind = p_kind and at > now() - p_window) >= p_max then
    raise exception 'rate_limited: %', p_kind using errcode = 'P0429';
  end if;
  insert into private.rate_events (user_id, kind) values (p_user, p_kind);
end $$;

create function private.latest_release() returns bigint
language sql stable security definer set search_path = '' as $$
  select max(id) from public.content_releases
$$;

-- New auth user (anonymous or permanent): profile plus three starter to-dos.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.todos (user_id, label, position) values
    (new.id, 'Register for the exam on Skilljar with your company email', 0),
    (new.id, 'Read the latest official exam guide', 1),
    (new.id, 'Book your Pearson VUE exam slot', 2);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.cap_todos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.todos where user_id = new.user_id) >= 50 then
    raise exception 'too_many_todos' using errcode = 'P0429';
  end if;
  return new;
end $$;

create trigger cap_todos before insert on public.todos
  for each row execute function private.cap_todos();

-- Scaled score estimate: 72% correct maps to the 720 cut score. Anthropic doesn't publish its scaling.
create function public.scaled_score(right_n int, total_n int) returns int
language sql immutable set search_path = '' as $$
  select case
    when total_n <= 0 then 100
    when right_n::numeric / total_n <= 0.72 then round(100 + (right_n::numeric / total_n / 0.72) * 620)
    else round(720 + ((right_n::numeric / total_n - 0.72) / 0.28) * 280)
  end::int
$$;

-- Shuffle a text array.
create function private.shuffled(arr text[]) returns text[]
language sql volatile set search_path = '' as $$
  select coalesce(array_agg(x order by random()), '{}') from unnest(arr) as x
$$;

-- Record a user's first answer to a question revision and update the aggregate stats.
create function private.record_answer(p_user uuid, p_qid text, p_rev int, p_correct boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.first_answers (user_id, question_id, rev, correct)
  values (p_user, p_qid, p_rev, p_correct) on conflict do nothing;
  if found then
    insert into private.question_stats as s (question_id, rev, attempts, correct)
    values (p_qid, p_rev, 1, p_correct::int)
    on conflict (question_id, rev) do update
      set attempts = s.attempts + 1, correct = s.correct + excluded.correct;
  end if;
end $$;

-- First-try stats shown in reviews, only once at least 10 people have answered.
create function private.stats_for(p_qid text, p_rev int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when attempts >= 10
    then jsonb_build_object('pct', round(100.0 * correct / attempts), 'n', attempts) end
  from private.question_stats where question_id = p_qid and rev = p_rev
$$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke execute on function public.scaled_score(int, int) from public;
grant execute on function public.scaled_score(int, int) to anon, authenticated;
