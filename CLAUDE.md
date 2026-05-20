# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

홈앤나사이 (package name `dohapapa`): a Korean-language decision tool that takes a household profile (income, assets, workplaces, priorities) and returns apartment complexes in the 수도권 (Seoul + Gyeonggi) that fit the household's estimated purchase budget, ranked into three tiers (안정형/균형형/도전형). Data is MOLIT (국토교통부) public transaction prices. Next.js 16 App Router + React 19 + Prisma + Tailwind 4.

## Commands

```bash
npm run dev          # next dev
npm run build        # next build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest run (all tests)
npm run test:watch   # vitest watch

# run a single test file / single test
npx vitest run tests/budget.test.ts
npx vitest run -t "name of test"

# database
npm run db:generate  # prisma generate
npm run db:migrate   # prisma migrate dev
npm run db:seed      # tsx prisma/seed.ts
```

There is no CI config; run `npm run lint`, `npm run typecheck`, and `npm test` manually before considering work done.

## Data pipeline (run in this order)

The DB ships with seed data so the app runs out of the box. To load real data, scripts assume an **empty** DB (they use `createMany`) and must run in sequence — each fills columns the next/the app depends on:

```bash
npx tsx scripts/wipe.ts                                          # clear DB first
npx tsx --env-file=.env.local scripts/fetch-molit.ts --gu=all   # complexes + transactions (needs MOLIT_API_KEY)
npx tsx --env-file=.env.local scripts/geocode-complexes.ts      # fills latitude/longitude (needs KAKAO_REST_KEY)
npx tsx --env-file=.env.local scripts/enrich-schools.ts         # fills nearestElemSchoolM for 초품아 scoring
```

`fetch-molit.ts` defaults to `--months=3 --gu=강남구,서초구,송파구`; pass `--gu=all` for all of 서울 25구 + 경기 (codes in `src/lib/molit.ts` `LAWD_CODES`). A complex with null lat/lng is invisible to the recommend engine (it's filtered out), so geocoding is mandatory after a fetch.

## Environment

`.env.local` (see `.env.example`). All keys are optional — the app degrades gracefully:
- `DATABASE_URL` / `DIRECT_URL` — **Postgres (Neon)** for both dev and prod. `DATABASE_URL` is the pooled connection (runtime, `-pooler` host, `pgbouncer=true`); `DIRECT_URL` is the direct connection used by `prisma migrate`. Prisma CLI reads `.env` not `.env.local`, so run migrations with the env injected (e.g. `set -a; . ./.env.local; set +a; npx prisma migrate dev`). The old SQLite `dev.db` is retired (kept locally as a backup only).
- `MOLIT_API_KEY` — only needed by `fetch-molit.ts`.
- `KAKAO_REST_KEY` — one key serves both geocoding (`src/lib/geocode.ts`) and commute routing (`src/lib/commute/kakaoProvider.ts`). **Without it, commute times fall back to the haversine `mockProvider`** and geocoding uses a built-in dictionary.
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` — SEO/analytics, fallbacks exist.

Path alias `@/*` → `src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

## Architecture

**Request flow:** `POST /api/recommend` (`src/app/api/recommend/route.ts`) validates the body with a Zod schema, then calls `recommendComplexes` (`src/lib/recommend/index.ts`). The UI is a single client component, `src/components/HomeExperience.tsx`, driving `ProfileForm.tsx` → the API → result cards.

**Budget estimation** (`src/lib/budget.ts`) is the financial core. It computes DSR-based loan capacity (stress rate 5.5%, 30yr 원리금균등), evaluates policy-loan eligibility (`src/lib/policyLoan.ts` — 디딤돌/신생아 특례/보금자리론), picks whichever of {policy, general DSR} gives the better outcome, applies an LTV ceiling, subtracts acquisition costs (`src/lib/acquisitionCost.ts`) and capital-gains tax on a sold home (`src/lib/capitalGainsTax.ts`), and outputs `netPurchasePowerKrw` plus human-readable `assumptions`/`warnings`/`loanReasonLines`.

**Recommendation engine** (`src/lib/recommend/index.ts`) is the algorithmic core:
1. Geographic pre-filter by haversine cutoff per workplace (`calcCutoffKm`).
2. Per-complex "현재가" estimate from recent transactions (`complexMedian.ts` — recency-weighted median × trend coefficient, not a plain median).
3. **Two-phase commute scoring:** every survivor is scored with the free `mockProvider` first; if a Kakao key exists, only the top ~40 are re-scored with the real routing API. Displayed candidates always come from the refined pool, so shown commute times are real measurements. This exists to avoid blowing the Kakao daily quota on thousands of complexes.
4. Per-signal scores (commute, budgetFit, school, buildingAge in `scoring.ts`) combined with weights derived from the user's 1–5 priorities (`buildWeights`).
5. Hard filters (price band, commute limit), then tier selection into 균형형/안정형/도전형, plus `moreCandidates` and (only when 0 results) `relaxationSuggestions`.

**Commute caching** (`src/lib/commute/index.ts`): only real (Kakao) results are cached in the `CommuteCache` table, keyed by origin coords rounded to 3 decimals (~100m). The mock provider is pure computation and intentionally bypasses the cache.

## Conventions and constraints that span files

- **No PII is ever persisted.** The household profile (income, assets, workplaces) is received in the request body, used for one computation, and discarded. The DB stores only public data (transactions) and the commute cache. See the header comment in `prisma/schema.prisma`. Do not add a table or log that stores profile fields.
- **`COMMUTE_HARD_FACTOR` (1.3) is duplicated** — it's defined in `src/lib/recommend/scoring.ts` and imported by `index.ts`. The scoring curve and the hard filter must use the same value; changing one means changing the constant in `scoring.ts` only.
- **Compliance language** (this is a regulated domain — 부동산/대출): avoid the word "추천" in user-facing copy; say "조건에 맞는 단지". Always mark budget/tax numbers as 추정 (`isEstimate: true` is a literal `true` in the type to enforce this). Policy-loan logic gives eligibility *guidance only* — never link or compare specific bank products. The `DISCLAIMER` constant must accompany results.
- **Money is plain `number` (KRW)**, not BigInt, throughout the app layer (max ~1e10, within JS safe-integer range). Only the Prisma `Transaction.priceKrw` column is `BigInt`.
- **Only car commute is supported.** `CommuteMode` is the single literal `"car"`; transit was removed. The Zod schema enforces `commuteMode: "car"`.
- **`householdType` drives branching** (single/dualIncome/singleIncome/retired): the Zod `superRefine` enforces which workplaces are required/forbidden, and `retired` zeroes the commute weight.
- Policy-loan thresholds in `policyLoan.ts` are hardcoded 2025–2026 constants; update the named constants when the regulations change.
- This is Next.js 16 with breaking changes from older versions — heed `@AGENTS.md` and read `node_modules/next/dist/docs/` before writing App Router / API code.
