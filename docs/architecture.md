# 아키텍처 개요

## 요청 흐름

사용자가 매물 정보를 제출하면 다음 순서로 처리됩니다.

```
브라우저
  │
  │  1. 매물 정보 입력 (단지명, 평형, 호가, 층, 향, 설명 등)
  ▼
ListingForm (src/components/ListingForm.tsx)
  │
  │  2. POST /api/analyze  (JSON body)
  ▼
API Route (src/app/api/analyze/route.ts)
  │
  ├─ 3a. DB에서 Complex 조회/생성 (Prisma upsert)
  │
  ├─ 3b. buildComparables()  ──────────────────────────────────┐
  │       (src/lib/comparables.ts)                              │
  │       동일 단지·유사 평형(±3㎡)의 최근 3개월 Transaction 조회│
  │       → 중위가·표준편차 계산                               │
  │                                                            │
  │       ← Transaction 테이블 (MOLIT 실거래 데이터로 채워짐) ←┘
  │
  ├─ 3c. computeScore(input, comp)
  │       (src/lib/score/index.ts)
  │       8개 신호 함수를 순서대로 실행 → 점수 합산 → band 결정
  │
  ├─ 3d. Listing + Score DB 저장 (Prisma create)
  │
  │  4. { id, score, askPriceKrw } 반환
  ▼
브라우저 → /analyze/[id] 로 이동
  │
  ▼
/analyze/[id] Page (App Router)
  ├── ScoreCard        — 총점 및 밴드 표시
  ├── SignalBreakdown  — 8개 신호 개별 점수 + 한국어 사유
  └── PriceDistribution — 동일 단지 최근 거래가 분포 차트 (Recharts)
```

## 데이터베이스

### 개발 환경 (SQLite)

`prisma/schema.prisma`의 `datasource` 블록에서 `provider = "sqlite"`를 사용합니다. 파일 경로는 `DATABASE_URL` 환경 변수로 지정합니다 (기본: `file:./dev.db`).

### 운영 환경 (PostgreSQL)

`provider`를 `"postgresql"`로 변경하고 `DATABASE_URL`에 PostgreSQL connection string을 지정합니다. 스키마 자체는 변경이 필요 없으나, `BigInt` 컬럼 처리와 `String`으로 저장된 JSON 컬럼은 동일하게 유지됩니다.

## 디렉토리 책임

| 경로 | 역할 |
|------|------|
| `src/app/api/analyze/route.ts` | POST 엔드포인트 — 입력 검증, DB 조작, 점수 계산 오케스트레이션 |
| `src/app/api/report/route.ts` | POST 엔드포인트 — 사용자 신고 접수 |
| `src/lib/score/` | 8개 신호 스코어러 모듈. `index.ts`가 진입점 |
| `src/lib/score/price.ts` | 가격 이상치 — z-score 기반, 최대 30점 |
| `src/lib/score/brokerConcentration.ts` | 중개사 집중도 (MVP placeholder) |
| `src/lib/score/stale.ts` | 시장 체류일 — 등록일 기준 경과일 |
| `src/lib/score/refresh.ts` | 수정일자 갱신 패턴 — 무변경 갱신 횟수 |
| `src/lib/score/photoReuse.ts` | 사진 재사용 (MVP placeholder) |
| `src/lib/score/info.ts` | 정보 부실 — 층/향/설명/사진 누락 여부 |
| `src/lib/score/keywords.ts` | 미끼 키워드 — 급매, VIP, 선착순 등 13개 |
| `src/lib/score/brokerHistory.ts` | 중개사 이력 (MVP placeholder) |
| `src/lib/molit.ts` | 국토교통부 API 클라이언트 — fetch, 파싱, 페이지네이션 |
| `src/lib/comparables.ts` | 비교 거래 집합 생성 — 중위가·표준편차 계산 |
| `src/lib/db.ts` | Prisma 싱글톤 클라이언트 |
| `src/lib/hashIp.ts` | 제출자 IP 단방향 해시 (익명화) |
| `src/lib/parseNaverUrl.ts` | 네이버 부동산 URL 파싱 유틸 (크롤링 없음, URL 구조만) |
| `src/types/listing.ts` | `ListingInput`, `ScoreResult`, `SIGNAL_WEIGHTS` 등 공유 타입 |
| `src/types/molit.ts` | `MolitDeal`, `MolitFetchOptions` 타입 |
| `src/components/` | UI 컴포넌트 (ListingForm, ScoreCard, SignalBreakdown, PriceDistribution) |
| `prisma/schema.prisma` | DB 스키마 (Complex, Transaction, Listing, Score, Report) |
| `prisma/seed.ts` | 개발용 시드 데이터 |
| `scripts/fetch-molit.ts` | MOLIT 데이터 수집 CLI 스크립트 |
| `tests/score/` | 신호 스코어러 단위 테스트 (Vitest) |

## 핵심 데이터 모델

```
Complex (단지)
  ├── id, name, sigungu, dongName, buildYear, totalHouseholds
  ├── → Transaction[] (MOLIT 실거래, source="MOLIT")
  └── → Listing[]     (사용자 제출 매물)

Listing (제출 매물)
  ├── askPriceKrw, area, floor, direction, description
  ├── brokerName, brokerPhoneHash
  ├── postedAt, lastModifiedAt, refreshHistory (JSON)
  ├── → Score (1:1, 의심도 점수)
  └── → Report[] (사용자 신고)

Score
  └── total(0–100), band, signals(JSON), reasoning(JSON)
```

## 스코어 계산 흐름

```
computeScore(input, comp)
  │
  ├── scorePrice()            — ComparableSet 필요 (없으면 0점)
  ├── scoreBrokerConcentration() — placeholder
  ├── scoreStale()            — postedAt 필요
  ├── scoreRefresh()          — refreshHistory 필요
  ├── scorePhotoReuse()       — placeholder
  ├── scoreInfo()             — floor/direction/description/photoCount 검사
  ├── scoreKeywords()         — description 텍스트 검사
  └── scoreBrokerHistory()    — placeholder
       │
       ▼
  total = sum(points), clamp(0, 100)
  band  = total >= 70 ? "red" : total >= 40 ? "yellow" : "green"
```
