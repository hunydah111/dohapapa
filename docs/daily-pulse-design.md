# 하이브리드 일간 폴링 + R-ONE 주간 — 설계

> 목적: "죽은 사이트 아냐?" 인식 차단. **매일 갱신되는 실체 + 정직한 날짜 표기**로 살아있음을 증명.
> 핵심 원칙: **속이지 않는다.** "언제~언제 자료를 오늘 갱신했다"를 정확히 명시한다.

## 1. 왜 호가가 아니라 실거래·지수인가
- 호가(네이버 부동산 등) = 공식 API 없음 · 크롤링 시 ToS 위반/저작권/부정경쟁 + 안티봇 유지보수 + DB0 아키텍처 파괴. solo·합법·비용0 조건에 정면충돌 → **채택 안 함.**
- 대신 **합법·무료·지속가능**한 두 축:
  - **A. 국토부 실거래** (이미 사용) — 매일 새 신고가 등록됨 → 일간 폴링으로 "매일 갱신" 실체.
  - **B. 한국부동산원 R-ONE 주간 매매가격지수** — 공식 "이번 주 시세 흐름". 호가의 합법 대체.

## 2. 하이브리드 = 가벼운 일간 + 무거운 주간
무거운 건(snapshot 6.6MB·trendIndex·DB 대량 read)을 매일 돌리면 git 비대 + Neon 쿼터 폭증.
→ **두 층으로 분리:**

| | 일간 (`daily-pulse.yml`, 매일 05:30 KST) | 주간 (`daily-data.yml`, 일요일 06:00 KST) |
|---|---|---|
| 무엇 | 최근 2개월 거래월 실거래 **재확인**(카운트·최신거래일) + R-ONE 주간 | **전체 시세 재계산**(snapshot·trendIndex·league·updateLog) |
| 비용 | API만, DB·snapshot 미변경 (가벼움) | 무거움(MOLIT 전수+Neon+6.6MB) |
| 커밋 | `dailyPulse.json` + `rebWeekly.json` (tiny) | 전체 데이터 JSON 7종 |
| 효과 | **매일 배포 = 매일 갱신 실체** | 정확한 추천·시세의 주간 재계산 |

## 3. 정직성 규칙 (속이지 않기)
- **국토부는 '계약일'만 공개, '신고일' 비공개.** 그래서 "오늘 신고됨"을 per-deal로 알 수 없다.
  → '신규'는 **매일 같은 거래월 창을 다시 세어 늘어난 만큼**(`newSincePrev`)으로만 정의. 페이지에 이 방식을 명시.
- **창을 명확히 표기**: "거래월 {from}~{to} 신고분을 오늘({checkedAt}) 다시 확인 · 최신 거래일 {latestDealDate}".
- **일간(최근 창 증분)과 주간(전체 누적 재계산)을 섞지 않는다.** 누적 576,697건은 주간 수치, 일간은 최근 창 수치로 분리 표기.
- R-ONE은 **"호가 아님 · 공식 가격지수의 주간 변동률"**이라고 명시.

## 4. 산출물·스크립트
- `scripts/daily-pulse.ts` → `src/data/dailyPulse.json` `{checkedAt, windowFromMonth, windowToMonth, latestDealDate, recentCount, newSincePrev, guCount}`. MOLIT만(DB0). `--gu=all --months=2`.
- `scripts/build-reb-weekly.ts` → `src/data/rebWeekly.json` `{asOfDate, asOfWeek, regions:{수도권|서울|경기|인천|전국:{index,changePct,week,date}}}`. R-ONE 주간표 `T244183132827305`의 tail 페이지만 받아 최신 주 추출(~4콜).
- 소비: `src/lib/livePulse.ts`(랜딩 펄스) · `src/lib/updateLog.ts`(`getDailyPulse`/`getWeeklyIndex`, /updates).

## 5. 표시 위치
- **랜딩 LivePulse**: "국토부 실거래 매일 확인 · {checkedAt} 기준" + 회전팩트에 거래월 창·R-ONE 주간 수도권·누적·최고상승·수록단지.
- **/updates**: ① 현재상태 ② **🟢 매일 실거래 확인**(거래월 창·최신거래일·신규방식 명시) ③ **📈 R-ONE 주간 시세(공식)** 권역칩 ④ 갱신 타임라인(주간 milestone).

## 6. 운영 주의
- ⚠️ **`REB_API_KEY`를 GitHub repo secrets 에 추가**해야 크론에서 R-ONE이 돈다(없으면 `continue-on-error`로 펄스만 커밋). 현재 `.env.local`엔 있음.
- 일간 커밋이 매일 Vercel 배포를 트리거 — 이게 "매일 갱신"의 실체(의도된 동작).
- 월 롤오버 시 거래월 창이 바뀌어 `newSincePrev=null`(신규 표기 생략) — 정상.
