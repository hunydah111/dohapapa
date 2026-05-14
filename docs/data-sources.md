# 데이터 소스

## 사용 중인 데이터 소스

### 국토교통부 실거래가 공개 API (아파트 매매)

dohapapa의 유일한 외부 데이터 소스입니다. 실제 체결된 아파트 매매 거래를 제공하며, 호가 대비 검증을 위한 진실 기준(truth anchor)으로 사용합니다.

| 항목 | 내용 |
|------|------|
| 서비스명 | 아파트매매실거래자료 |
| 엔드포인트 | `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev` |
| 등록 URL | https://www.data.go.kr (공공데이터포털 → 아파트매매실거래자료 → 활용신청) |
| 인증 방식 | `serviceKey` 쿼리 파라미터 (URL-encoded, 재인코딩 금지) |
| 비용 | 무료 |
| 응답 형식 | JSON (`_type=json` 파라미터로 지정) |

#### 요청 파라미터

| 파라미터 | 설명 | 예시 |
|----------|------|------|
| `serviceKey` | 발급받은 API 키 | (pre-encoded) |
| `LAWD_CD` | 시군구 법정동코드 앞 5자리 | `11680` (강남구) |
| `DEAL_YMD` | 거래 연월 (YYYYMM) | `202604` |
| `pageNo` | 페이지 번호 (1부터) | `1` |
| `numOfRows` | 페이지당 행 수 | `1000` |
| `_type` | 응답 형식 지정 | `json` |

서울 25개 구 코드는 `src/lib/molit.ts`의 `SEOUL_GU_CODES` 맵에 정의되어 있습니다.

#### 응답 구조

```json
{
  "response": {
    "header": { "resultCode": "00", "resultMsg": "NORMAL SERVICE." },
    "body": {
      "totalCount": 1234,
      "items": {
        "item": [
          {
            "aptNm": "래미안대치팰리스",
            "dealYear": "2024", "dealMonth": "4", "dealDay": "15",
            "dealAmount": "120,500",
            "excluUseAr": "84.99",
            "floor": "12",
            "umdNm": "대치동",
            "buildYear": "2015"
          }
        ]
      }
    }
  }
}
```

- `dealAmount` 단위: 만원 (예: `"120,500"` → 12억 500만 원)
- `items.item`은 단일 결과인 경우 배열이 아닌 객체로 반환될 수 있습니다. `src/lib/molit.ts`의 `normalizeItems()`가 정규화합니다.
- 결과가 없을 때 `items`는 빈 문자열 또는 null이 될 수 있습니다.

#### 속도 제한 및 주의사항

공공데이터포털 기준 일반 활용 신청 시 초당 호출 수 제한이 적용됩니다 (신청 시 확인). `scripts/fetch-molit.ts`는 구(gu)와 월(month)을 순차적으로 처리하며, 별도의 rate-limit 처리 로직은 포함하지 않습니다. 대량 수집 시 요청 간 지연을 고려해야 합니다.

#### 데이터 저장 위치

수집된 거래는 `Transaction` 테이블에 `source = "MOLIT"`로 저장됩니다. 동일 거래(단지, 날짜, 면적, 층, 가격 일치)는 중복 삽입하지 않습니다.

---

### 공동주택단지 기본정보 API (향후 개선 대상)

국토교통부 공동주택단지 기본정보 API를 통해 단지의 세대수, 준공연도, 동수 등 마스터 데이터를 정규화할 수 있습니다. 현재 MVP에서는 MOLIT 실거래 응답에 포함된 `aptNm` / `umdNm` / `buildYear`를 그대로 사용하며, 단지명 정규화는 수행하지 않습니다. 향후 동일 단지가 표기 방식 차이로 중복 생성되는 문제를 해결하기 위한 개선 포인트입니다.

---

## 사용하지 않는 데이터 소스

### 네이버 부동산 / 직방 / 다방

**사용 안 함.**

이들 서비스의 이용약관은 자동화된 데이터 수집(크롤링, 스크래핑)을 명시적으로 금지합니다. 유사 사례로 잡코리아가 사람인의 크롤링 행위에 대해 법적 조치를 취한 판례가 있으며, 부동산 포털 데이터는 저작권 및 데이터베이스 보호 법률의 적용 대상이 될 수 있습니다.

따라서 dohapapa는 포털 페이지를 직접 수집하지 않습니다. 매물 정보는 사용자가 직접 입력하거나 URL을 붙여넣기 하는 방식으로만 수집합니다. `src/lib/parseNaverUrl.ts`는 URL 문자열의 구조를 파싱할 뿐 네트워크 요청을 보내지 않습니다.

### KISO 부동산매물클린관리센터

**현재 사용 안 함 — 향후 신호 보강 후보.**

한국인터넷자율정책기구(KISO) 부동산매물클린관리센터는 중개사 허위매물 신고 이력 데이터를 관리합니다. API 접근이 공개되거나 데이터 공유 협약이 체결된다면 `brokerHistory` 신호의 데이터 소스로 활용할 수 있습니다. 현재 해당 신호는 MVP placeholder 상태입니다.

---

## 환경 변수 설정

```ini
# .env.local

# MOLIT API 키 — data.go.kr에서 "아파트매매실거래자료" 활용 신청 후 발급
MOLIT_API_KEY="your-api-key-here"

# DB (개발: SQLite)
DATABASE_URL="file:./dev.db"
```
