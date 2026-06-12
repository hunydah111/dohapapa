# dohapapa

부부가 함께 집을 고를 때 가장 어려운 문제, 즉 두 직장을 동시에 고려한 통근 부담을 수치로 풀어주는 주거지 탐색 의사결정 도구입니다. 양쪽 직장 좌표와 가구 재무 정보를 입력하면, 국토교통부 실거래가 기반으로 예산에 맞는 아파트 단지를 선별하고 통근·학군·예산 적합도를 복합 점수로 산출해 세 가지 안정형/균형형/도전형 후보를 제시합니다. 특정 매물을 중개하거나 투자 자문을 제공하지 않습니다.

## 주요 기능

- 부부 직장 주소(또는 좌표) 입력 → 단지별 양측 통근 시간 동시 계산
- DSR 40% / LTV / 스트레스 DSR 공개 공식 기반 구매력 추정 (항상 "추정"으로 표시)
- 취득세·중개수수료·부대비용 합산 실매입 가능 상한액 산출
- 통근 / 예산 적합도 / 학군·자녀 / 단지 연식 4개 신호 복합 점수화
- 안정형·균형형·도전형 3개 후보 단지 제시 (단지 레벨, 개별 매물 알선 없음)
- 결과 하단 법적 면책 고지 항상 표시
- 사용자 재무 정보는 DB 미저장 — 요청당 계산 후 즉시 폐기

## 기술 스택

| 구분 | 사용 기술 |
|------|-----------|
| 프레임워크 | Next.js 16 (App Router, Turbopack) |
| 언어 | TypeScript 5 |
| 스타일 | Tailwind CSS v4 |
| ORM / DB | Prisma 6 — SQLite(개발) / PostgreSQL(운영) |
| 검증 | Zod 3 |
| 차트 | Recharts 2 |
| 테스트 | Vitest 2 |
| 스크립트 런타임 | tsx |

## 시작하기

```powershell
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

개발 서버가 `http://localhost:3000`에서 실행됩니다.

## 환경 변수

`.env.example`을 복사해 `.env.local`을 만든 뒤 값을 채웁니다.

```powershell
copy .env.example .env.local
```

| 변수 | 필수 여부 | 설명 |
|------|-----------|------|
| `DATABASE_URL` | 필수 | SQLite: `file:./dev.db` / PostgreSQL: connection string |
| `MOLIT_API_KEY` | 선택 | data.go.kr 아파트매매실거래자료 API 키. 미설정 시 시드 데이터로 동작 |
| `KAKAO_REST_KEY` | 선택 | 카카오 Local·Mobility REST API 키. 미설정 시 mock 통근 제공자 사용 |

`MOLIT_API_KEY`와 `KAKAO_REST_KEY` 없이도 앱은 완전히 동작합니다. 실데이터가 필요한 경우에만 발급하면 됩니다.

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 (Turbopack) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run typecheck` | TypeScript 타입 검사 (`tsc --noEmit`) |
| `npm run test` | Vitest 단위 테스트 실행 |
| `npm run test:watch` | Vitest watch 모드 |
| `npm run db:generate` | Prisma 클라이언트 생성 |
| `npm run db:migrate` | DB 마이그레이션 적용 |
| `npm run db:seed` | 시드 데이터 삽입 |

### MOLIT 실거래 데이터 수집

`.env.local` 에 키가 설정된 상태에서:

```powershell
# 1) 합성 시드 제거 (실데이터로 교체할 때)
npx tsx --env-file=.env.local scripts/wipe.ts

# 2) MOLIT 실거래가 수집 (MOLIT_API_KEY 필요)
npx tsx --env-file=.env.local scripts/fetch-molit.ts --months=6 --gu="강남구,서초구,송파구"

# 3) 단지 좌표 지오코딩 (KAKAO_REST_KEY 필요) — 추천 엔진이 단지를 쓰려면 필수
npx tsx --env-file=.env.local scripts/geocode-complexes.ts
```

MOLIT 데이터엔 좌표가 없으므로 fetch 후 반드시 geocode 를 실행해야 합니다.
`--gu` 기본값은 강남·서초·송파, `--months` 기본값은 3.

## 프로젝트 구조

```
dohapapa/
├── src/
│   ├── app/              # Next.js App Router (pages, API routes)
│   ├── components/       # React 컴포넌트 (ProfileForm, BudgetSummary, CandidateCards 등)
│   ├── lib/
│   │   ├── budget.ts         # 구매력 추정 (DSR/LTV)
│   │   ├── acquisitionCost.ts # 취득세·중개수수료·부대비용
│   │   ├── commute/          # 통근 엔진 (mock + Kakao Mobility 어댑터)
│   │   ├── recommend/        # 단지 점수화·후보 선별
│   │   └── molit.ts          # 국토교통부 API 클라이언트
│   └── types/
│       ├── profile.ts        # CoupleProfile, Workplace, Segment
│       └── recommendation.ts # BudgetEstimate, ComplexCandidate, RecommendationResult
├── prisma/
│   ├── schema.prisma     # DB 스키마 (Complex, Transaction, CommuteCache)
│   └── seed.ts           # 개발용 시드 데이터
├── scripts/
│   ├── fetch-molit.ts        # MOLIT 실거래 데이터 수집 CLI
│   ├── geocode-complexes.ts  # 단지 좌표 지오코딩 (Kakao Local)
│   └── wipe.ts               # DB 초기화 (시드↔실데이터 교체용)
├── tests/                # Vitest 단위 테스트
└── docs/
    ├── architecture.md
    ├── scoring.md
    ├── legal.md
    └── data-sources.md
```

## 계측 5지표 + 수익화 점화 기준 (2026-06-12 한 방 스펙)

GA4 이벤트 5종 — 전부 비-PII(소득·자산·직장 미포함):

| 이벤트 | 의미 | 위치 |
|---|---|---|
| `result_card_created` | 판정 카드 생성 (깔때기 바닥) | HomeExperience.handleResult |
| `share_click` | 공유 클릭 (`method`: friend_throw / result_link) | handleShareFriend·handleShare |
| `friend_visit` | 도전장 링크(?f=) 유입 | HomeExperience mount |
| `friend_convert` | 도전장 유입자가 입력 완료 (K팩터 분자) | handleResult + ?f= |
| `policy_cta_click` | 정책대출 CTA 클릭 (`context`: result / plan) | PolicyLoanCta |

**돈 구석 점화 기준 — 셋 다 충족 전에는 PolicyLoanCta의 href(기금e든든 공식)를 제휴 링크로 바꾸지 않는다:**

1. **볼륨**: 주간 `result_card_created` 수백 건(≥300) 4주 연속
2. **인텐트**: `policy_cta_click` / 노출 CTR 두 자릿수(≥10%) 안정
3. **리걸 게이트(필수)**: 금소법상 "광고 매체 vs 광고 주체" 구분·미등록자 대출성 상품 광고 가능 범위 **법률 검토 완료** — href 교체 전 선행 조건

점화 시에도 워딩 불변: "자격 가능성 안내 · 최종 심사는 기관" 유지, 추천·중개·확실·보장 표현 금지.
플랜B: 정책대출 자격자가 기금e든든으로 직행해 CTA 인텐트가 어긋나면, 화력을 /plan 갭 화면(목표를 정한 뜨거운 리드)으로 이동.

## 법적 입장

본 서비스는 국토교통부 공개 실거래가 API(공공데이터포털, 무료)를 주요 데이터 소스로 사용합니다. 네이버 부동산·직방·다방 등 민간 포털 크롤링은 수행하지 않습니다. 결과 화면에 표시되는 정보는 중개·투자자문·대출모집이 아닌 참고용 정보 제공이며, 법적 컴플라이언스 세부 내용은 [`docs/legal.md`](docs/legal.md)를 참조하십시오.

## 라이선스

MIT
