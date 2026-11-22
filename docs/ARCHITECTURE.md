# Architecture

## Pieces

| Layer | What |
|---|---|
| `content/` | The source of truth for notes and questions (JSON + Markdown). Validated by `src/lib/content/load.ts`, loaded by `scripts/sync-content.ts` into Supabase through `public.import_content` (service role only). |
| Supabase Postgres | Content tables (public read), per-user tables (row-level security: owner only), and `private.answer_keys` (no client access). All grading is in `SECURITY DEFINER` functions in `supabase/migrations/`. |
| Next.js 16 | `src/app/(public)`: static, cached, indexable pages rendered from the database at build time. `src/app/(app)`: client pages that call the database functions with the user's session. |

## Why grading lives in Postgres

- Answer keys never leave the database until an item is revealed (instant mode) or an attempt is finished.
- Clients see options in a per-attempt shuffled order and answer with **positions**, never option ids, so nothing can be inferred from ids.
- The exam deadline (`ends_at`), grading and saving happen in one transaction; saves after the deadline are refused and finalize the attempt.
- The web app never holds a secret key. Row-level security plus these functions are the only authorization layer, and pgTAP tests exercise them directly.

## Sessions

- `src/proxy.ts` refreshes the Supabase session cookie only on app routes, so public pages stay static and never set cookies.
- Guests get a Supabase **anonymous** user only when they click "Continue as guest" (never on page view).
- Upgrading a guest keeps the same user id: email via `updateUser` + an `email_change` code, or Google via `linkIdentity`.
- If the email or Google account already has an account, the guest gets a single-use merge ticket (httpOnly cookie, 30 minutes). After signing in, `claim_merge_ticket` moves the guest's attempts, reports and progress over.

## Content versions

- Each question has a `content_hash` and a `rev`; changing its text, options or answer bumps `rev`, so stats restart and old reviews show "Question updated since".
- Each import records a `content_releases` row (label + git SHA), shown in the footer. Importing the same content twice is a no-op.
- The exam blueprint (`ccdvf-2026-07`) is a row of its own, so a new exam guide becomes a new blueprint without schema changes.

## Housekeeping (pg_cron)

- Every 5 minutes: finalize exams whose time ran out with no client around.
- Daily: delete guest accounts inactive for 30 days (aggregate stats are kept), prune rate-limit events and expired merge tickets.

## Limits inside the database

120 quiz starts per hour, 10 exam starts per day, 20 question reports per day, 50 to-dos per user.
