# Deploying ccdf-prep (Supabase + Vercel, free tiers)

The database is managed **from your terminal** with the Supabase CLI (no deploy pipeline). Vercel builds the site automatically when you push to `main`.

Because the public pages are built from the database, **update the database first, then push the code**:

```bash
npm run deploy:db   # supabase db push (migrations) + load content/ into the hosted project
git push            # Vercel builds the new site
```

## 1. Supabase project (once)

1. Create a project at [supabase.com](https://supabase.com) (free tier; pick the region closest to your users) and save the **database password**.
2. Link this repo to it from the terminal:
   ```bash
   supabase login
   supabase link --project-ref <ref>      # <ref> is in the project URL: https://<ref>.supabase.co
   ```
   `supabase link` only affects commands that target the hosted project (`db push`). Local commands (`supabase start`, `npm run db:reset`) still use your local Docker stack.
3. Create `.env.production.local` (git-ignored) for the content import. Values are in **Project Settings → API keys**:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
   SUPABASE_SECRET_KEY=<secret key>        # stays on your machine only
   ```
4. Push the schema and content:
   ```bash
   npm run deploy:db
   ```
   The import prints the URL it's writing to (`(HOSTED)` vs `(local)`), and running it again with unchanged content does nothing.

## 2. Authentication settings (Supabase dashboard → Authentication, once)

| Setting | Value |
|---|---|
| Sign In / Providers → **Allow anonymous sign-ins** | On |
| Sign In / Providers → **Allow manual linking** | On |
| Sign In / Providers → Email → **Confirm email** | **On** (required: otherwise a guest could attach any email address without proving they own it) |
| Email → OTP length / expiry | 6 digits / 3600 s |
| URL Configuration → **Site URL** | `https://your-domain` |
| URL Configuration → **Redirect URLs** | `https://your-domain/auth/callback` (add preview domains if you use them) |
| Emails → Templates | Paste `supabase/templates/otp.html` into **Magic link** and **Confirm signup**, and `supabase/templates/email_change.html` into **Change email address** (they show the one-time code `{{ .Token }}`; the app accepts 6–10 digits) |

Set these in the dashboard rather than with `supabase config push`: `supabase/config.toml` holds local values (like `localhost` URLs) that must not overwrite production.

### Your SMTP (required for real users)

Supabase's built-in mailer only sends to project team members, so sign-in codes need your own SMTP. **Authentication → Emails → SMTP Settings**:

| Field | Value |
|---|---|
| Enable custom SMTP | On |
| Sender email / name | e.g. `no-reply@your-domain` / `ccdf-prep` |
| Host / Port | from your provider (usually port 587) |
| Username / Password | from your provider |

Then raise **Rate Limits → emails per hour** to fit your traffic. The SMTP password stays in Supabase, never in this repo or in env files.

### Google sign-in

1. Google Cloud Console → **APIs & Services → OAuth consent screen**: app name `ccdf-prep`, support email, links to `https://your-domain/privacy` and `/terms`, scopes `email`, `profile`, `openid`.
2. **Credentials → Create OAuth client ID** (Web application). Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`.
3. Supabase → **Sign In / Providers → Google**: enable and paste the client ID and secret.

### Bot protection (Turnstile)

1. Cloudflare dashboard → **Turnstile** → add a widget for your domain (managed mode). Note the site key and secret.
2. Supabase → **Attack Protection → Enable CAPTCHA protection** → Turnstile → paste the **secret**.
3. Put the **site key** in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` on Vercel.

## 3. Vercel (once)

1. Import the GitHub repository in Vercel (framework: Next.js). Pushes to `main` deploy production; pull requests get preview deploys.
2. **Environment variables** (Production and Preview), all public values:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://your-domain`
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - **Do not** add the secret key: the site never uses it.
3. Run `npm run deploy:db` **before** the first Vercel build, so the build finds content.

## Keeping the free tier awake

Free Supabase projects pause after a week without activity. `vercel.json` schedules a daily Vercel Cron call to `/api/keepalive`, which does one tiny read. Nothing to set up beyond deploying on Vercel.

## Day to day

| Change | Run |
|---|---|
| Content in `content/` | `npm run content:validate`, then `npm run content:sync:prod`, then `git push` (rebuilds the pages) |
| New migration in `supabase/migrations/` | `npm run db:push` (or `npm run deploy:db`), then `git push` |
| Code only | `git push` |

Never edit a migration that has already been pushed; add a new one. `supabase migration list` shows what's applied where.

## Check the deploy

- `/`, `/notes/<module>`, `/exam-format`, `/sitemap.xml` and `/robots.txt` load, and the page source of a notes page contains the note text.
- Start as a guest, finish a module quiz, sign in with an email code: your progress is kept.
- Sign in with Google.
- Start an exam, refresh mid-way (it resumes), end it, and check the results.
- The footer shows the content release label and date. `/api/keepalive` returns `{"ok":true,...}`.

## Taking it down

Delete the Vercel project (the site goes offline immediately), then pause or delete the Supabase project.
