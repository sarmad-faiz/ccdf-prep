-- Housekeeping jobs (pg_cron).

create extension if not exists pg_cron;

create function private.expire_stale_exams() returns void
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  for v in select id from public.exam_attempts where status = 'in_progress' and ends_at < now() - interval '1 minute' loop
    perform private.finalize_exam(v, 'expired');
  end loop;
end $$;

-- Guests who haven't been active for 30 days are removed (their rows cascade; aggregate stats stay).
create function private.cleanup_anonymous_users() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users u
   where u.is_anonymous
     and coalesce((select p.last_active_at from public.profiles p where p.user_id = u.id), u.created_at)
         < now() - interval '30 days';
$$;

create function private.prune_housekeeping() returns void
language sql security definer set search_path = '' as $$
  delete from private.rate_events where at < now() - interval '2 days';
  delete from private.merge_tickets where expires_at < now() - interval '1 day';
$$;

revoke all on all functions in schema private from public, anon, authenticated;

select cron.schedule('ccdf-expire-stale-exams', '*/5 * * * *', 'select private.expire_stale_exams()');
select cron.schedule('ccdf-cleanup-anonymous-users', '17 3 * * *', 'select private.cleanup_anonymous_users()');
select cron.schedule('ccdf-prune-housekeeping', '41 3 * * *', 'select private.prune_housekeeping()');
