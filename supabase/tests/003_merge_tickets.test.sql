-- Guest -> existing account merge tickets: anonymous source only, single use, expiring.
begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        null, '{}', '{}', now(), now(), true),
       ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'owner@test.local', '{}', '{}', now(), now(), false);

set local role authenticated;
-- the guest practises and creates a ticket
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated","is_anonymous":true}', true);
select public.start_quiz('module:m1');
create temp table t as select public.create_merge_ticket() as token;

-- a permanent user cannot create a ticket
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated","is_anonymous":false}', true);
select throws_ok('select public.create_merge_ticket()', null, 'not_anonymous', 'only guests can create merge tickets');

-- the account owner claims it: the guest's attempt moves over
select is((public.claim_merge_ticket((select token from t)) ->> 'merged')::boolean, true, 'ticket merges the guest');
select is((select count(*)::int from public.quiz_attempts), 1, 'the guest''s quiz attempt now belongs to the account');
select is((public.claim_merge_ticket((select token from t)) ->> 'merged')::boolean, false, 'a ticket works only once');
select is((public.claim_merge_ticket('not-a-real-token') ->> 'reason'), 'invalid_ticket', 'unknown tokens are rejected');

-- a guest cannot claim tickets
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated","is_anonymous":true}', true);
create temp table t2 as select public.create_merge_ticket() as token;
select throws_ok(format($$select public.claim_merge_ticket(%L)$$, (select token from t2)), null, 'still_anonymous',
  'a guest cannot claim a ticket');
reset role;

-- expired tickets are rejected
update private.merge_tickets set expires_at = now() - interval '1 minute';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated","is_anonymous":false}', true);
select is((public.claim_merge_ticket((select token from t2)) ->> 'reason'), 'invalid_ticket', 'expired tickets are rejected');
reset role;

select * from finish();
rollback;
