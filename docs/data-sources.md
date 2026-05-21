# 데이터 소스

## 사용 중인 데이터 소스

### 국토교통부 실거래가 공개 API (핵심)

dohapapa의 핵심 데이터 소스입니다. 공식 체결 아파트 매매 거래 데이터를 제공하며, 단지별 중위 실거래가 산출의 근거로 사용합니다.

| 항목 | 내용 |
|------|------|
| 서비스명 | 아파트매매실거래자료 |
| 엔드포인트 | `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev` |
| 등록 URL | https://www.data.go.kr (공공데이터포털 → 아파트매매실거래자료 → 활용신청) |
| 인증 방식 | `serviceKey` 쿼리 파라미터 (URL-encoded, 재인코딩 금지) |
| 환경 변수 | `MOLIT_API_KEY` |
| 비용 | 무료 |
| 응답 형식 | JSON (`_type=json` 파라미터로 지정) |
| 수집 스크립트 | `scripts/fetch-molit.ts` |

`MOLIT_API_KEY`가 설정되지 않은 경우 앱은 `prisma/seed.ts`로 삽입된 시드 데이터로 동작합니다. 실거래 데이터가 없는 단지는 후보 선별에서 제외됩니다.

#### 수집 스크립트 사용법

```powershell
npx tsx scripts/fetch-molit.ts --months=3 --gu="강남구,서초구,송파구"
```

| 파라미터 | 설명 | 기본값 |
|----------|------|--------|
| `--months` | 오늘 기준 수집할 개월 수 | 3 |
| `--gu` | 수집할 구 목록 (쉼표 구분) | 강남구,서초구,송파구 |

서울 25개 구 코드는 `src/lib/molit.ts`의 `SEOUL_GU_CODES`에 정의되어 있습니다. 수집된 거래는 `Transaction` 테이블에 `source = "MOLIT"`로 저장되며 중복은 건너뜁니다.

#### 요청 파라미터

| 파라미터 | 설명 | 예시 |
|----------|------|------|
| `serviceKey` | 발급받은 API 키 | (pre-encoded) |
| `LAWD_CD` | 시군구 법정동코드 앞 5자리 | `11680` (강남구) |
| `DEAL_YMD` | 거래 연월 (YYYYMM) | `202604` |
| `pageNo` | 페이지 번호 (1부터) | `1` |
| `numOfRows` | 페이지당 행 수 | `1000` |
| `_type` | 응답 형식 지정 | `json` |

---

### 카카오 API (선택, mock fallback 있음)

#### Kakao Local API — 지오코딩 (회사명 → 좌표)

사용자가 회사명을 입력한 경우 좌표로 변환하는 데 사용합니다.

| 항목 | 내용 |
|------|------|
| 용도 | 회사명 또는 주소 문자열 → (lat, lng) 변환 |
| 엔드포인트 | `https://dapi.kakao.com/v2/local/search/keyword.json` |
| 환경 변수 | `KAKAO_REST_KEY` |
| Fallback | `KAKAO_REST_KEY` 미설정 시 시드 좌표 테이블에서 조회 |

#### Kakao Mobility API — 자동차 통근 시간

단지 좌표에서 각 직장까지의 **자동차** 통근 시간을 계산합니다(서버 호출).

| 항목 | 내용 |
|------|------|
| 용도 | 출발지 → 목적지 자동차 이동 시간(분) 계산 |
| 모드 | `car` (자동차) 전용 — 대중교통은 ODsay 사용 |
| 엔드포인트 | `https://apis-navi.kakaomobility.com/v1/directions` |
| 환경 변수 | `KAKAO_REST_KEY` (서버) |
| Fallback | `KAKAO_REST_KEY` 미설정 시 `MockCommuteProvider` 사용 |
| 캐시 | `CommuteCache` 테이블 (mode=`car`, originKey: 좌표 소수 3자리 반올림) |

`KAKAO_REST_KEY`는 선택 환경 변수입니다. 미설정 시 앱은 `MockCommuteProvider`(직선거리 기반 추정)로 대체 동작하며 기능 전체가 유지됩니다.

---

### ODsay 대중교통 길찾기 API (선택, mock fallback 있음)

대중교통(`transit`) 통근 시간을 계산합니다. **카카오는 대중교통 길찾기를 제공하지 않아 ODsay를 사용**합니다.

| 항목 | 내용 |
|------|------|
| 용도 | 직장 → 단지 대중교통 소요시간(분) 계산 |
| 엔드포인트 | `https://api.odsay.com/v1/api/searchPubTransPathT` |
| 경로 선택 | 반환 경로 중 **`info.totalTime` 최소(최단 시간)** 경로 채택 (최소 환승 아님) |
| 환경 변수 | `NEXT_PUBLIC_ODSAY_KEY` (URI/웹 키) |
| 호출 위치 | **브라우저(클라이언트)** — URI 키는 등록 도메인(Referer)으로 잠김 |
| 적용 범위 | 화면에 보이는 후보(메인 3개 카드)만 실측. 랭킹·보조 리스트는 mock(직선거리) |
| Fallback | 키 미설정·호출 실패 시 직선거리 mock 추정 |
| 캐시 | `CommuteCache` 테이블 (mode=`transit`) — `/api/transit`로 적재, 무료 1,000콜/일 절약 |

> WHY 서버키 대신 URI 키: ODsay 서버키는 호출 IP 화이트리스트라 Vercel 동적 IP에선 불가. URI 키(도메인 Referer 잠금)를 브라우저에서 호출한다. 시각(출발시각) 파라미터는 보내지 않으므로 **표준(평균) 소요**이며 러시아워 기준이 아니다.

---

## 향후 통합 예정 데이터 소스

### 학교알리미 (교육통계서비스)

초등학교 학생 수, 학급 수 등 학군 관련 정보를 제공합니다. 현재 MVP에서 `school` 신호는 `nearestElemSchoolM`(최단 초등학교 도보 거리) 시드 추정값만 사용합니다. 학교알리미 API 연동이 완료되면 학급 규모, 특수학급 유무 등 추가 지표를 반영할 계획입니다.

---

## 사용하지 않는 데이터 소스

### 네이버 부동산 / 직방

**사용 안 함.**

이들 서비스의 이용약관은 자동화된 데이터 수집(크롤링, 스크래핑)을 명시적으로 금지합니다. 부동산 포털 데이터는 저작권 및 데이터베이스 보호 법률의 적용 대상이 될 수 있습니다. dohapapa는 이들 서비스로부터 어떠한 데이터도 수집하지 않습니다.

---

## 환경 변수 요약

```ini
# .env.local

# MOLIT API 키 — data.go.kr에서 "아파트매매실거래자료" 활용신청 후 발급
# 미설정 시 시드 데이터로 동작
MOLIT_API_KEY="your-molit-api-key"

# 카카오 REST API 키 — developers.kakao.com에서 앱 생성 후 발급
# 미설정 시 mock 지오코딩·통근 제공자로 동작
KAKAO_REST_KEY="your-kakao-rest-key"

# DB (개발: SQLite)
DATABASE_URL="file:./dev.db"
```
