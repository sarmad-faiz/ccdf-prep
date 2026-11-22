# Testing

## Automated

```bash
npm run db:start && npm run db:reset   # fresh local database with content
npm run content:validate               # content rules
npm test                               # unit tests (vitest)
npm run db:test                        # database tests (pgTAP): scoring, grading, timer, access, merge tickets
npm run check:leaks                    # end-to-end API check that nothing secret reaches the client early
npm run lint && npm run typecheck && npm run build
```

CI runs all of these on every pull request.

## Manual end-to-end checklist

Run against `npm run dev` with local Supabase. Sign-in codes arrive in Mailpit at http://127.0.0.1:55324. Browser automation (for example Playwright via an MCP server) is fine, but don't add Playwright packages, configs or spec files to this repo.

1. **SEO:** the page source of `/notes/prompting-agents-tool-use` contains the note text, and the response has no `Set-Cookie` header. `/robots.txt` and `/sitemap.xml` load.
2. **Guest quiz:** `/dashboard` → Continue as guest → Module 1 quiz with the keyboard (A–D, Enter). In instant mode each answer shows its explanation. In the network tab, no answer or explanation appears before you answer.
3. **Sign-in nudge:** finishing the first quiz shows "Save your progress across devices?"; "Continue as guest" hides it.
4. **End-of-quiz mode:** switch "Show answers" to "At the end", take a quiz using Back; results, "Retry the missed", and "Review mistakes" work.
5. **Weak topics:** the dashboard lists weak topics; a topic link opens the notes at that section with "Your misses" open and the section marked.
6. **Upgrade a guest:** Sign in with a new email → code from Mailpit → the dashboard keeps the same progress (same user id in `auth.users`, now `is_anonymous = false`).
7. **Merge into an existing account:** sign out, practise as a new guest, sign in with the existing email → the guest's attempts appear under that account.
8. **Exam:** start Practice exam A as a guest (sign-in notice shown) → answer, flag (F), try to pick three on a "Choose two" item (refused), refresh mid-exam (resumes at the same item), review screen filters, end with the confirmation, results with domain bars and Missed/Flagged/All.
9. **Server timer:** with an exam running, set its deadline close: `update public.exam_attempts set ends_at = now() + interval '10 seconds' where status = 'in_progress';` then reload the page. At zero it submits and the results say "time expired". A later save from another tab is refused.
10. **Report a question** from a review; it appears in `public.question_reports`.
11. **Dark mode and a 375 px wide screen:** no horizontal scrolling.
