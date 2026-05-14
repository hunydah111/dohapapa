# 아키텍처 개요

## 요청 흐름

사용자가 부부 프로필을 제출하면 다음 순서로 처리됩니다.

```
브라우저
  │
  │  1. 부부 직장·자녀·재무 정보 입력
  ▼
ProfileForm (src/components/ProfileForm.tsx)
  │
  │  2. POST /api/recommend  (JSON body: CoupleProfile)
  ▼
API Route (src/app/api/recommend/route.ts)
  │
  ├─ 3a. estimateBudget(profile)
  │       (src/lib/budget.ts)
  │       DSR 40% + 스트레스 DSR + LTV 공개 공식 → BudgetEstimate
  │       (취득세·수수료는 src/lib/acquisitionCost.ts 에서 별도 계산)
  │
  └─ 3b. recommendComplexes(profile, budget)
          (src/lib/recommend/index.ts)
          │
          ├─ DB에서 Complex + 대표 평형 Transaction 중위가 조회
          │
          ├─ 하드 필터: netPurchasePower 초과 단지 제외
          │             양측 통근 허용 초과 단지 제외
          │
          ├─ 통근 시간 계산 — 단지별 양측 직장 경로
          │   (src/lib/commute/)
          │   KAKAO_REST_KEY 설정 여부에 따라 어댑터 선택:
          │     있음 → KakaoMobilityAdapter (실제 API)
          │     없음 → MockCommuteProvider (시드 기반 추정)
          │   결과는 CommuteCache 테이블에 저장 (중복 계산 방지)
          │
          ├─ 4개 신호 점수화 (src/lib/recommend/scorer.ts)
          │   commute / budgetFit / school / buildingAge
          │   primaryConcern 에 따라 가중치 동적 조정
          │
          └─ 총점 기준 정렬 → 3개 tier 선별
             안정형 (1위) / 균형형 (2위) / 도전형 (3위)
  │
  │  5. RecommendationResult 반환
  ▼
브라우저 → HomeExperience 페이지 렌더
  ├── BudgetSummary   — 추정 구매력·대출 한도·부대비용 요약
  ├── CandidateCards  — 3개 후보 카드 (단지명·점수·통근·중위가)
  └── Disclaimer      — 법적 면책 고지 (항상 표시)
```

## 디렉토리 책임

| 경로 | 역할 |
|------|------|
| `src/app/api/recommend/route.ts` | POST 엔드포인트 — 입력 검증, 예산 추정, 단지 선별 오케스트레이션 |
| `src/lib/budget.ts` | DSR·LTV 공식 기반 구매력 추정. 결과는 항상 `isEstimate: true` |
| `src/lib/acquisitionCost.ts` | 취득세·중개수수료·부대비용 합산 계산 |
| `src/lib/commute/` | 통근 엔진. `provider.ts` 인터페이스 + mock·Kakao 어댑터 |
| `src/lib/recommend/` | 복합 점수화, 하드 필터, tier 선별. `index.ts` 가 진입점 |
| `src/lib/molit.ts` | 국토교통부 API 클라이언트 — fetch, 파싱, 페이지네이션 |
| `src/lib/db.ts` | Prisma 싱글톤 클라이언트 |
| `src/types/profile.ts` | `CoupleProfile`, `Workplace`, `Segment`, `DEFAULT_MAX_COMMUTE_MIN` |
| `src/types/recommendation.ts` | `BudgetEstimate`, `ComplexCandidate`, `RecommendationResult`, `CANDIDATE_SIGNAL_WEIGHTS`, `DISCLAIMER` |
| `src/components/ProfileForm.tsx` | 부부 프로필 입력 폼 |
| `src/components/BudgetSummary.tsx` | 예산 추정 요약 UI |
| `src/components/CandidateCards.tsx` | 후보 단지 카드 목록 |
| `prisma/schema.prisma` | DB 스키마 (Complex, Transaction, CommuteCache) |
| `prisma/seed.ts` | 개발용 시드 데이터 |
| `scripts/fetch-molit.ts` | MOLIT 데이터 수집 CLI |
| `tests/` | Vitest 단위 테스트 |

## 통근·지오코딩 제공자 패턴

통근 시간 계산과 회사명 → 좌표 변환(지오코딩)은 환경 변수 유무로 제공자를 선택합니다.

| 기능 | 환경 변수 | 실제 제공자 | Fallback |
|------|-----------|-------------|----------|
| 지오코딩 (회사명 → 좌표) | `KAKAO_REST_KEY` | Kakao Local API | Mock (시드 좌표 테이블) |
| 통근 시간 계산 | `KAKAO_REST_KEY` | Kakao Mobility API | MockCommuteProvider |

`MockCommuteProvider`는 단지 좌표와 직장 좌표의 직선거리에 보정 계수를 적용해 분 단위를 추정합니다. API 키 없이도 앱 전체가 동작하도록 설계되어 있습니다.

## 데이터베이스

### 개발 환경 (SQLite)

`prisma/schema.prisma`의 `datasource` 블록에서 `provider = "sqlite"`를 사용합니다. `DATABASE_URL=file:./dev.db`로 지정합니다.

### 운영 환경 (PostgreSQL)

`provider`를 `"postgresql"`로 변경하고 `DATABASE_URL`에 PostgreSQL connection string을 지정합니다. 스키마 변경은 불필요합니다.

## 핵심 데이터 모델

```
Complex (단지 마스터)
  ├── id, name, sigungu, dongName, buildYear, totalHouseholds
  ├── latitude, longitude
  ├── nearestElemSchoolM, nearestSubwayM  (학군·입지 보조)
  └── → Transaction[]  (MOLIT 실거래, source="MOLIT")

Transaction (실거래)
  └── complexId, dealDate, priceKrw(BigInt), area, floor, source

CommuteCache (통근 시간 캐시)
  └── originKey(좌표 3자리 반올림), complexId, mode, minutes
      @@unique([originKey, complexId, mode])
```

## 사용자 프로필 미저장 원칙

`CoupleProfile`(소득·자산·직장·자녀)은 DB에 저장하지 않습니다. API 요청 본문으로 수신해 1회 계산에만 사용하고 폐기합니다. 영속 데이터는 공개 데이터(실거래가)와 통근 캐시뿐입니다. 이 원칙은 개인정보 최소수집 요건을 충족하기 위한 것으로, 컴플라이언스 패널 권고에 따라 설계되었습니다.
