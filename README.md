# cardbuy · Claude Code init pack

A Peacock Solutions project for Lewis. A Pokémon trading card buylist, built as a bespoke Next.js 14 / Supabase app.

---

## What this is

This isn't a codebase — it's the **spec pack** that seeds one. Drop these files into an empty repository, open Claude Code, and the agent has everything it needs to build Phase 1 (the wireframe) without a single clarifying question.

---

## How to use it

### 1. Create the repo

```bash
mkdir cardbuy && cd cardbuy
git init
```

### 2. Drop these files at the repo root

```
cardbuy/
├── CLAUDE.md                     # root context — read first, every session
├── PHASE1_WIREFRAME.md           # ← active phase
├── PHASE2_DATA_LAYER.md          # preview
├── PHASE3_PRICING_ENGINE.md      # preview
├── SCHEMA.sql                    # target data shape (reference)
└── README.md                     # this file
```

### 3. Scaffold Next.js

Either let Claude Code do it on its first run, or do it yourself first:

```bash
pnpm create next-app@latest . --typescript --tailwind --app --src-dir=false --import-alias="@/*" --eslint
```

### 4. Open Claude Code

From inside the repo:

```bash
claude
```

On first run, Claude will read `CLAUDE.md` automatically. Then kick off Phase 1 with:

```
Read PHASE1_WIREFRAME.md and confirm the scope back to me in 5 bullets before writing any code.
```

### 5. Promote phases as you finish them

When Phase 1 is signed off, promote Phase 2:

```
Phase 1 is accepted. Read PHASE2_DATA_LAYER.md and begin execution.
```

---

## Phase order

| Phase | File | Status |
|---|---|---|
| 1 | `PHASE1_WIREFRAME.md` | Complete |
| 5 | `PHASE5_BRANDING.md` | Complete (promoted ahead of 2–4) |
| 2a | `PHASE2_DATA_LAYER.md` | **Active** — auth + submissions |
| 2b | `PHASE2_DATA_LAYER.md` | Queued — card catalogue + margin dials |
| 3 | `PHASE3_PRICING_ENGINE.md` | Queued |
| 4 | `PHASE4_SUBMISSION_LIFECYCLE.md` | Not yet written |

---

## First-run setup (Phase 2a · Supabase)

1. **Apply the schema.** Open [Supabase Studio → SQL Editor](https://app.supabase.com) for the project and paste the contents of `supabase/migrations/0001_phase2a_auth_submissions.sql`. It creates `lewis_users`, `lewis_submissions`, `lewis_submission_items`, the reference generator, and RLS policies. Safe to re-run.
2. **Copy env vars.** `cp .env.example .env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase → Settings → API.
3. **Configure the magic-link redirect URL.** In Supabase → Authentication → URL Configuration, add `http://localhost:3000/auth/callback` (dev) and your production callback URL (e.g. `https://cardbuy.vercel.app/auth/callback`) to "Redirect URLs".
4. **Run the app.** `pnpm dev` → visit `http://localhost:3000/login`, request a magic link, check the email, click the link. You'll land on `/submission` as an authenticated seller.

**Promote an admin:** in Supabase → SQL Editor, `update lewis_users set role = 'admin' where email = 'you@example.com';`

---

## Working principles

- **Spec-first.** Every phase has a written prompt. No verbal scope changes.
- **Scope discipline.** If a phase prompt doesn't ask for it, Claude asks before building it.
- **Raw data, computed offers.** Prices are stored as retrieved; margins apply at read time.
- **Admin panel is the product.** Every pricing decision is a Lewis-facing dial.
- **Mocks before integrations.** Fake data is a feature of Phase 1, not a limitation.

See `CLAUDE.md` §09 for the full working model.

---

## Prerequisites

- Node 20+
- pnpm
- Claude Code CLI
- (Phase 2+) Supabase CLI, a Supabase project, a Vercel account, a pokemontcg.io API key, a PokemonPriceTracker API key

---

## Open questions for the operator

These should be resolved before Phase 2 kicks off, but don't block Phase 1:

- [ ] Final project / brand name (currently `cardbuy` as a working codename)
- [ ] Peacock Solutions' actual business address (for the confirmation page placeholder)
- [ ] Whether Lewis wants graded card submissions at all, or raw-only for V1
- [ ] Minimum submission total (e.g. £10 — reject £1.50 single-card submissions to avoid admin cost outweighing profit)
- [ ] What Randolph actually uses for RandCards' pricing data (Lewis to ask)

---

## Credits

Spec prepared by Peacock Solutions (Michael) with Claude.
