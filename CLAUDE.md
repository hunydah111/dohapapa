# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

비집고 (package name `dohapapa`; the product has also been called 홈앤나사이/홈앤나 — `SITE_NAME` in `src/lib/site.ts` is the source of truth): a Korean-language decision tool that takes a household profile (income, assets, workplaces, priorities) and returns apartment complexes in the 수도권 (Seoul + Gyeonggi) that fit the household's estimated purchase budget, ranked into three tiers (안정형/균형형/도전형). Data is MOLIT (국토교통부) public transaction prices. Next.js 16 App Router + React 19 + Prisma + Tailwind 4.

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
npx tsx --env-file=.env.local scripts/fetch-presale.ts --gu=all # ADD 분양권/입주권 deals (idempotent; needs MOLIT_API_KEY)
npx tsx --env-file=.env.local scripts/geocode-complexes.ts      # fills latitude/longitude (needs KAKAO_REST_KEY)
npx tsx --env-file=.env.local scripts/enrich-schools.ts         # fills nearestElemSchoolM for 초품아 scoring
npx tsx --env-file=.env.local scripts/enrich-households.ts      # fills totalHouseholds (세대수) from K-apt — idempotent; needs KAPT_API_KEY (or reuses MOLIT key)
npx tsx --env-file=.env.local scripts/build-trend-index.ts      # bakes src/data/trendIndex.json (commit it)
npx tsx --env-file=.env.local scripts/build-snapshot.ts         # bakes src/data/complexSnapshot.json (commit it) — runtime reads this, NOT the DB
npx tsx scripts/build-league.ts                                 # bakes src/data/leagueTable.json (동네 자존심 리그) — reads bundled trendIndex+snapshot, no DB/env
```

`fetch-molit.ts` defaults to `--months=3 --gu=강남구,서초구,송파구`; pass `--gu=all` for all of 서울 25구 + 경기 (codes in `src/lib/molit.ts` `LAWD_CODES`). A complex with null lat/lng is invisible to the recommend engine (it's filtered out), so geocoding is mandatory after a fetch.

Unlike the others, `fetch-presale.ts` is **additive and idempotent** (it only deletes/reloads `source ∈ {분양권,입주권}` rows and find-or-creates complexes), so it can re-run on a populated DB. It exists because pre-registration new builds have no 매매 rows — only 분양권 — so without it those complexes show no price. `build-trend-index.ts` computes a (시군구 × 가격대) repeat-sales index from the loaded data and writes `src/data/trendIndex.json`, which is bundled and read at runtime by `src/lib/recommend/trendIndex.ts` (re-run + commit after loading new data; if the JSON is empty all time-adjustments degrade to ×1). **`build-snapshot.ts` is the final step** (run *after* build-trend-index, since baked medians use the index for time-adjustment): it bakes per-complex metadata + (평형별 추정 현재가) into `src/data/complexSnapshot.json` — **the recommend engine reads this at runtime instead of the DB, so a search makes zero DB queries** (this is what keeps the app alive when Neon hits its data-transfer quota). Re-run + commit after loading new data; if missing, recommendations degrade to empty. It can read from Neon (default) or a local SQLite backup (`--from-sqlite=prisma/dev.db`) when the DB is unreachable. `scripts/export-sqlite.ts` / `import-postgres.ts` are one-off helpers from the retired-SQLite → Neon migration.

## Environment

`.env.local` (see `.env.example`). All keys are optional — the app degrades gracefully:
- `DATABASE_URL` / `DIRECT_URL` — **Postgres (Neon)** for both dev and prod. `DATABASE_URL` is the pooled connection (runtime, `-pooler` host, `pgbouncer=true`); `DIRECT_URL` is the direct connection used by `prisma migrate`. Prisma CLI reads `.env` not `.env.local`, so run migrations with the env injected (e.g. `set -a; . ./.env.local; set +a; npx prisma migrate dev`). The old SQLite `dev.db` is retired (kept locally as a backup only).
- `MOLIT_API_KEY` — needed by `fetch-molit.ts` / `fetch-presale.ts`. Also reused by `enrich-households.ts` if `KAPT_API_KEY` is unset (same data.go.kr portal key, but the K-apt API must be 활용신청'd for that account).
- `KAPT_API_KEY` — optional, for `enrich-households.ts` (세대수 from K-apt 공동주택 기본정보). Falls back to `MOLIT_API_KEY`. Without either, 세대수 stays null and 대단지 점수 degrades to the 거래량 proxy; the UI simply hides the "N세대" chip.
- `KAKAO_REST_KEY` — one key serves both geocoding (`src/lib/geocode.ts`) and commute routing (`src/lib/commute/kakaoProvider.ts`). **Without it, commute times fall back to the haversine `mockProvider`** and geocoding uses a built-in dictionary.
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` — SEO/analytics, fallbacks exist.

Path alias `@/*` → `src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

## Architecture

**Request flow:** `POST /api/recommend` (`src/app/api/recommend/route.ts`) validates the body with a Zod schema, then calls `recommendComplexes` (`src/lib/recommend/index.ts`). The UI is a single client component, `src/components/HomeExperience.tsx`, driving `ProfileForm.tsx` → the API → result cards.

**Budget estimation** (`src/lib/budget.ts`) is the financial core. The profile carries a `budgetMode`: `"simple"` takes `availableBudgetKrw` directly (skips the loan math), `"detailed"` (default) computes DSR-based loan capacity (stress rate 5.5%, 30yr 원리금균등), evaluates policy-loan eligibility (`src/lib/policyLoan.ts` — 디딤돌/신생아 특례/보금자리론), picks whichever of {policy, general DSR} gives the better outcome, applies an LTV ceiling, subtracts acquisition costs (`src/lib/acquisitionCost.ts`) and capital-gains tax on a sold home (`src/lib/capitalGainsTax.ts`). Either way it outputs `netPurchasePowerKrw` plus human-readable `assumptions`/`warnings`/`loanReasonLines`.

**Recommendation engine** (`src/lib/recommend/index.ts`) is the algorithmic core. **It reads no DB on the hot path** — complex metadata and per-complex medians come from the bundled `complexSnapshot.json` via `src/lib/recommend/snapshot.ts` (`getSnapshotComplexes` / `getMediansForIds`, both synchronous). The only request-time DB touch left is the optional car-commute cache (`src/lib/commute/index.ts`), which has a circuit breaker that degrades to the mock provider if the DB is unavailable (so a down/over-quota Neon never 500s or hangs a search).
1. Geographic pre-filter by haversine cutoff per workplace (`calcCutoffKm`). Hard filters `requiredRegions` (시군구) and area range are applied at the snapshot-filter / median step.
2. Per-complex "현재가" estimate baked into the snapshot at build time (`complexMedian.ts` — recency-weighted median, then **time-adjusted to the latest month** by the `trendIndex.ts` bridge factor keyed on 시군구 × price-tier; the pure compute is `groupTxRows` + `mediansFromGrouped`, shared by the runtime and the snapshot builder). For a recent new-build that has *no* direct transaction in the chosen area band, `estimateRep.ts` bridges a price from nearby comps weighted by distance/build-year/한강-proximity (gated to builds ≤3yr old that exist in MOLIT). Such candidates are flagged `priceEstimated` / `priceFromPresale`.
3. **Two-phase commute scoring:** every survivor is scored with the free `mockProvider` first; if a Kakao key exists, only the top ~60 (`REFINE_COUNT`) are re-scored with the real **car** routing API. Displayed candidates always come from the refined pool, so shown car times are real measurements. This avoids blowing the Kakao daily quota on thousands of complexes.
4. Per-signal scores in `scoring.ts` — `commute`, `budgetFit`, `school`, `buildingAge`, `largeComplex` — combined with weights from the user's 1–5 priorities (`buildWeights`; the four user-facing priorities are commute/school/buildingAge/largeComplex, with `budgetFit` weight auto-derived). **`buildingAge` is intentionally neutralized to a constant 60** — the price-first philosophy holds that age/재건축 value is already in the transaction price, so it must not be double-counted. A separate soft bonus `scoreLocationVibe` (`locationVibe.ts`, 한강변/조용함) and small liquidity/stability baselines are added on top, capped.
5. Hard filters (price band, commute limit), then tier selection into 균형형/안정형/도전형, plus `moreCandidates`, `overLimitCandidates` (slightly over the commute limit), `overBudgetCandidates` (≤1.4× budget), a `closestCandidates` safety net (when all sections are empty), and `relaxationSuggestions` (which condition to loosen, with simulated result counts).

**Commute caching** (`src/lib/commute/index.ts`): both car and transit commute are supported (`CommuteMode = "car" | "transit"`). **Transit is special:** the ODsay API is browser-only, so server-side ranking scores transit legs with the `mockProvider` (haversine), and real transit minutes are measured client-side in the browser after results render — then sent back via the **2-pass re-rank** (`transitOverrides` + `restrictToComplexIds` in the request body, see `RecommendOptions`) so tiers/hard-filters recompute on measured times. Only real Kakao **car** results are cached in the `CommuteCache` table, keyed by origin coords rounded to 3 decimals (~100m). The mock provider (and therefore all server-side transit) is pure computation and intentionally bypasses the cache.

## Conventions and constraints that span files

- **No PII is ever persisted.** The household profile (income, assets, workplaces) is received in the request body, used for one computation, and discarded. The DB stores only public data (transactions) and the commute cache. See the header comment in `prisma/schema.prisma`. Do not add a table or log that stores profile fields.
- **`COMMUTE_HARD_FACTOR` (1.3) is duplicated** — it's defined in `src/lib/recommend/scoring.ts` and imported by `index.ts`. The scoring curve and the hard filter must use the same value; changing one means changing the constant in `scoring.ts` only.
- **Compliance language** (this is a regulated domain — 부동산/대출): avoid the word "추천" in user-facing copy; say "조건에 맞는 단지". Always mark budget/tax numbers as 추정 (`isEstimate: true` is a literal `true` in the type to enforce this). Policy-loan logic gives eligibility *guidance only* — never link or compare specific bank products. The `DISCLAIMER` constant must accompany results.
- **Money is plain `number` (KRW)**, not BigInt, throughout the app layer (max ~1e10, within JS safe-integer range). Only the Prisma `Transaction.priceKrw` column is `BigInt`.
- **Two commute modes, asymmetric handling.** `CommuteMode = "car" | "transit"` (per-workplace, so a dual-income couple can mix). Car uses the Kakao routing API server-side and is cached; transit is ranked server-side with the mock and only gets real times via the client-driven 2-pass re-rank (see Commute caching above). Don't assume server-side transit minutes are real measurements.
- **Price-first scoring philosophy.** The transaction price is treated as the market's verdict, so hand-rolled proxies that the price already reflects (building age, 재건축 expectation) must not re-score a complex. `buildingAge` is pinned to a neutral 60; surface market signals through `budgetFit` and the "동네 또래단지보다 비싸요" per-㎡ peer-premium badge instead of inventing labels. Keep extra signals opt-in/soft (e.g. `locationVibe`).
- **`householdType` drives branching** (single/dualIncome/singleIncome/retired): the Zod `superRefine` enforces which workplaces are required/forbidden, and `retired` zeroes the commute weight.
- Policy-loan thresholds in `policyLoan.ts` are hardcoded 2025–2026 constants; update the named constants when the regulations change.
- This is Next.js 16 with breaking changes from older versions — heed `@AGENTS.md` and read `node_modules/next/dist/docs/` before writing App Router / API code.
