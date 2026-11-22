# Contributing to ccdf-prep

Thanks for helping other people prepare. Most contributions are content fixes, so that's covered first.

## Ground rules

- Be kind; see the [Code of Conduct](CODE_OF_CONDUCT.md).
- **Never paste text from the official course, its quizzes or the real exam.** Write in your own words and point to the course section instead.
- Content is CC BY-NC-SA 4.0; by contributing you agree your contribution is licensed the same way (code under MIT).

## Fixing or adding content

Everything learners see lives in [`content/`](content/):

| File | Holds |
|---|---|
| `notes/m1.md` … `m5.md` | Module notes. Each `## Heading` is a topic and must match the `topic` of that module's questions. |
| `notes/recall.md` | The 60-second recall page. |
| `questions/m1.json` … `m5.json` | Module quiz questions. |
| `exam/questions/d1.json` … `d8.json` | Exam questions, one file per exam domain. |
| `exam/sets.json` | Which questions make up Practice exams A, B and C. |
| `exam/blueprint.json` | Exam format, domain weights and which module topics feed which domain. |

A question looks like this:

```json
{
  "id": "x-d8-01",
  "objective": "Tool Implementation",
  "q": "A search tool marks all eight of its parameters as required... What should you change?",
  "options": [
    { "id": "a", "text": "Mark only essential fields required and give the rest defaults" },
    { "id": "b", "text": "..." },
    { "id": "c", "text": "..." },
    { "id": "d", "text": "..." }
  ],
  "answer": "a",
  "explain": "Why the answer is right and why the others are wrong."
}
```

Module questions have `topic` instead of `objective`. "Choose two" items have five options, an array `answer` like `["a", "c"]`, and end the stem with `(Choose two.)`.

### Question style

- One short scenario, one concept, at foundations level. No trick questions.
- Four options of similar length; the right answer shouldn't stand out by length or wording.
- Never refer to option letters in the explanation (options are shuffled).
- Use backticks for code, parameter names and file paths. No HTML.
- Every fact must come from the course. In your PR, cite the module and section you checked.

### Rules the validator enforces

Run `npm run content:validate` before opening a PR. It checks unique ids, valid answers, topics vs headings, the exam sets' domain counts, no overlap between sets, and no HTML. **Never reuse or renumber an id**: removed questions are retired (add the id to `retiredIds` in `content/manifest.json`), because people's past attempts point at them.

Editing a question's text, options or answer gives it a new revision automatically, so its stats start fresh.

## Code changes

1. `npm install`, `npm run db:start`, `npm run db:reset`, `cp .env.example .env.local` (fill it from `supabase status`), `npm run dev`.
2. Database changes go in a **new** migration under `supabase/migrations/`; never edit one that has shipped.
3. Before opening a PR: `npm run lint && npm run typecheck && npm test && npm run db:test && npm run check:leaks && npm run build`.
4. Grading and anything involving answers belongs in Postgres functions, not in the browser. `npm run check:leaks` must keep passing.

## Pull requests

Keep PRs focused, describe what changed and why, and fill in the PR template. CI runs the checks above. A maintainer merges and then publishes the content to the live database.
