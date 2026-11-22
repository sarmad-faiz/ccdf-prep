# CCDF Prep

<img src="src/app/icon.svg" width="40" alt="" align="left">

Free, open-source study notes, module quizzes and timed practice exams for the **Claude Certified Developer – Foundations (CCDV-F)** exam.

> [!IMPORTANT]
> **Unofficial.** CCDF Prep (`ccdf-prep`) is a community project. It is **not affiliated with, endorsed by, or sponsored by Anthropic, PBC** or Pearson VUE. "Claude" and "Anthropic" are trademarks of Anthropic. Nothing here is official exam material.

## What's inside

| Part | What you get |
|---|---|
| **Revision notes** | Short notes for all five modules of the official prep course, plus a one-page 60-second recall. Public and SEO-friendly. |
| **Module quizzes** | 92 questions, graded on the server, with an explanation for every answer. Feedback after each question or at the end. |
| **Practice exams A, B, C** | Three fixed 53-item exams with no shared questions, weighted by the eight exam domains. Pearson VUE style: 120-minute server-side timer, flag for review, review screen, "Choose two" items scored all-or-nothing, results by domain. |
| **Mixed exam** | 53 random items by domain weight, unseen ones first. |
| **Progress** | Practise as a guest (no sign-up) or sign in with an email code or Google. Guest progress carries over when you sign in. |
| **Quality loop** | "Report this question" on every reviewed item, and first-try correct rates once enough people have answered. |

## About the content

- **Notes** are a learner's own condensed summaries of Anthropic's official CCDV-F prep course. They're not copies of it; read the official course for the full material.
- **Questions** are original practice questions written from the course content and checked against it. They are not real exam questions and don't reproduce the course's own quizzes.
- **Exam format and domain weights** follow Exam Guide v1.0 (July 2026) as reported by third-party sites. Pearson VUE lists updated exam content from **7 December 2026**, so check the current official guide.
- **Scaled scores** are estimates (72% correct ≈ 720). Anthropic doesn't publish its scaling.

If you represent Anthropic and would like anything changed or removed, please [open an issue](../../issues) and it will be handled promptly.

## Run it locally

Requirements: Node.js 22.18+ (24 recommended), Docker, and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
npm run db:start          # local Supabase (API on :55321, mail inbox on :55324)
npm run db:reset          # apply migrations and load content/
cp .env.example .env.local   # then fill in the values printed by `supabase status`
npm run dev               # http://localhost:3000
```

Sign-in codes sent locally land in Mailpit at http://127.0.0.1:55324.

| Command | Does |
|---|---|
| `npm run content:validate` | Check everything in `content/` |
| `npm run content:sync` | Load `content/` into Supabase |
| `npm test` | Unit tests (content rules, helpers) |
| `npm run db:test` | Database tests (grading, timer, access rules) |
| `npm run check:leaks` | Confirms no answer reaches the browser before it should |
| `npm run lint` / `npm run typecheck` / `npm run build` | The usual |

## How it works

- **Next.js 16** (App Router, Cache Components). Notes and the exam-format page are static and indexable; practice pages are client components and never indexed.
- **Supabase** holds content and progress. Answer keys live in a private schema; quizzes and exams are graded by Postgres functions, so answers and explanations never reach the browser before you answer or finish.
- Content is edited as files in [`content/`](content/). The maintainer loads it into the hosted database from the terminal (`npm run deploy:db`); see [docs/DEPLOY.md](docs/DEPLOY.md).

More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DEPLOY.md](docs/DEPLOY.md) and [docs/TESTING.md](docs/TESTING.md).

## Contributing

Corrections and new questions are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Found a wrong answer? Use "Report this question" in the app or open a content issue.

## License

- Code: [MIT](LICENSE)
- Content in `content/` (notes and questions): [CC BY-NC-SA 4.0](content/LICENSE)
