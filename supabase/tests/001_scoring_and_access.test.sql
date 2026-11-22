-- Scoring, access control and answer-key secrecy. Needs content loaded (npm run db:reset).
begin;
select plan(14);

-- scaled score (72% correct = 720 cut score)
select is(public.scaled_score(0, 53), 100, '0/53 scores 100');
select is(public.scaled_score(38, 53), 717, '38/53 scores 717 (fail)');
select is(public.scaled_score(39, 53), 736, '39/53 scores 736 (pass)');
select is(public.scaled_score(72, 100), 720, '72% scores exactly the 720 cut');
select is(public.scaled_score(53, 53), 1000, '53/53 scores 1000');

-- content is loaded
select ok((select count(*) from public.questions where retired_at is null) > 200, 'content is synced');

-- logged-out visitors: public content yes, questions and answers no
set local role anon;
select ok((select count(*) from public.modules) = 5, 'anon reads modules');
select throws_ok('select * from public.questions', '42501', null, 'anon cannot read questions');
select throws_ok('select * from private.answer_keys', '42501', null, 'anon cannot read answer keys');
select throws_ok($$select public.start_quiz('mixed')$$, '42501', null, 'anon cannot start a quiz');
reset role;

-- signed-in users: still no direct access to questions or keys
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'a@test.local', '{}', '{}', now(), now(), false),
       ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'b@test.local', '{}', '{}', now(), now(), false);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok('select * from public.questions', '42501', null, 'users cannot read questions directly');
select throws_ok('select * from private.answer_keys', '42501', null, 'users cannot read answer keys');
select public.start_quiz('module:m1');

-- user B can't see user A's attempt
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.quiz_attempts), 0, 'user B sees none of user A''s attempts');
select throws_ok(
  format($$select public.get_quiz(%L)$$, (select id from public.quiz_attempts where user_id = '11111111-1111-1111-1111-111111111111' limit 1)),
  null, 'not_found', 'user B cannot open user A''s quiz');
reset role;

select * from finish();
rollback;
