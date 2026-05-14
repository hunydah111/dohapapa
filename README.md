# dohapapa

서울 아파트 매물의 허위매물 가능성을 0–100점으로 수치화하는 분석 도구입니다. 국토교통부 실거래가 공개 API를 진실 기준(truth anchor)으로 삼아 가격 이상치, 중개사 행동 패턴, 미끼 키워드 등 8개 신호를 개별 점수로 분해해 보여줍니다. 분석 대상 데이터는 사용자가 직접 입력하거나 URL을 붙여넣는 방식으로만 수집하며, 포털 사이트 크롤링은 법적 이유로 수행하지 않습니다.

## 주요 기능

- 매물 정보 수동 입력 및 외부 URL 제출
- 국토부 실거래가 기반 가격 이상치 탐지 (z-score)
- 8개 신호 개별 점수 + 한국어 사유 표시 (SignalBreakdown)
- 의심도 밴드: 초록(안전) / 노랑(주의) / 빨강(위험)
- 최근 거래가 분포 차트 (Recharts)
- 매물 신고 기능 (Report)
- 국토부 실거래 데이터 주기적 동기화 스크립트

## 기술 스택

| 구분 | 사용 기술 |
|------|-----------|
| 프레임워크 | Next.js 15 (App Router) |
| 언어 | TypeScript 5 |
| 스타일 | Tailwind CSS v4 |
| ORM / DB | Prisma 6 — SQLite(개발) / PostgreSQL(운영) |
| 차트 | Recharts 2 |
| 테스트 | Vitest 2 |
| 스크립트 런타임 | tsx |
| 검증 | Zod 3 |

## 시작하기

```powershell
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Bash를 사용하는 경우에도 동일한 명령어가 동작합니다.

## 환경 변수

`.env.example`을 복사해 `.env.local`을 만든 뒤 값을 채웁니다.

```powershell
copy .env.example .env.local
```

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | SQLite: `file:./dev.db` / PostgreSQL: connection string |
| `MOLIT_API_KEY` | data.go.kr 아파트매매실거래자료 API 키 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오 지도 API 키 (선택) |
| `IP_HASH_SALT` | 익명 제출자 IP 해시 솔트 (임의 문자열) |

자세한 내용은 [`docs/data-sources.md`](docs/data-sources.md)를 참조하세요.

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 (localhost:3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run typecheck` | TypeScript 타입 검사 (`tsc --noEmit`) |
| `npm run test` | Vitest 단위 테스트 실행 |
| `npm run db:generate` | Prisma 클라이언트 생성 |
| `npm run db:migrate` | DB 마이그레이션 적용 |
| `npm run db:seed` | 시드 데이터 삽입 |

## MOLIT 실거래 데이터 동기화

국토교통부 API에서 실거래 데이터를 가져와 DB에 upsert합니다. `MOLIT_API_KEY`가 `.env.local`에 설정되어 있어야 합니다.

```powershell
npx tsx scripts/fetch-molit.ts --months=3 --gu="강남구,서초구,송파구"
```

- `--months` : 오늘 기준 몇 개월 전까지 수집할지 (기본값: 3)
- `--gu` : 수집할 구 이름 목록, 쉼표 구분 (기본값: 강남구,서초구,송파구)
- 서울 25개 구 코드가 모두 내장되어 있습니다 (`src/lib/molit.ts` 참조).

스크립트는 중복 거래를 건너뛰고 신규 건만 삽입합니다.

## 법적 입장

본 서비스는 국토교통부 실거래가 공개 API(공공데이터포털, 무료)만을 데이터 소스로 사용합니다. 네이버 부동산, 직방, 다방 등 민간 포털의 페이지를 크롤링하거나 스크래핑하지 않습니다. 사용자가 직접 입력하거나 붙여넣기한 정보만 분석에 활용합니다. 자세한 내용은 [`docs/data-sources.md`](docs/data-sources.md)를 참조하세요.

## 프로젝트 구조

```
dohapapa/
├── src/
│   ├── app/          # Next.js App Router (pages, API routes)
│   ├── components/   # React 컴포넌트 (ListingForm, ScoreCard, SignalBreakdown, PriceDistribution)
│   ├── lib/          # 비즈니스 로직 (score/, molit.ts, comparables.ts, db.ts)
│   └── types/        # 공유 타입 (listing.ts, molit.ts)
├── prisma/
│   ├── schema.prisma # DB 스키마 (Complex, Transaction, Listing, Score, Report)
│   └── seed.ts       # 시드 데이터
├── scripts/
│   └── fetch-molit.ts # MOLIT 실거래 데이터 수집 스크립트
├── tests/
│   └── score/        # 신호 스코어러 단위 테스트 (Vitest)
└── docs/
    ├── architecture.md
    ├── data-sources.md
    └── scoring.md
```

## 라이선스

MIT
