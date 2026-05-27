// 프로덕션 스모크 — 배포 후 "조용히 꺼진 기능"을 한눈에 잡는다.
// 결과화면은 env·도메인·번들 데이터가 다 맞아야 뜨므로, #p= 자체완결 링크로
// 폼 없이 결과를 띄우고 핵심 기능이 실제로 렌더되는지 브라우저로 검증한다.
//
// 사용법:  node scripts/smoke.cjs [baseUrl]   (기본 https://bijigo.kr)
//          npm run smoke
//
// CORE 하나라도 실패하면 종료코드 1. INFO 는 켜짐/꺼짐만 보고(실패 아님).
// 통근수단 transit → 서버 mock 채점이라 카카오 길찾기 API 비용 0(미니맵 SDK는 별개).
const { chromium } = require("playwright");

const BASE = (process.argv[2] || "https://bijigo.kr").replace(/\/+$/, "");

// 결과가 잘 나오는 안전한 1인가구 프로필(강남역·예산 8억·transit).
const profile = {
  householdType: "single",
  priorities: { commute: 3, school: 3, buildingAge: 3, largeComplex: 2 },
  preferredAreaRanges: ["p32_35"],
  budgetMode: "simple",
  availableBudgetKrw: 800000000,
  workplaceA: { label: "강남역", lat: 37.498, lng: 127.0276, commuteMode: "transit", maxCommuteMinutes: 60 },
  hasSchoolAgedChild: false, hasInfant: false, hasTwoOrMoreChildren: false,
  hasThreeOrMoreChildren: false, isExpectingChild: false,
  hasOwnedHomeBefore: false, isNewlywed: false,
  householdIncomeKrwYear: 0, seedMoneyKrw: 0, netAssetsKrw: 0, existingLoanMonthlyKrw: 0,
};

// 레거시(비압축) base64url — HomeExperience 의 decodeProfile 이 MARKER 없으면 이 포맷 처리.
const slug = Buffer.from(JSON.stringify(profile), "utf8")
  .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const url = `${BASE}/#p=${slug}`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

  const kakaoErrors = [];
  let recStatus = null, recCandidates = null, recError = null;

  page.on("console", (m) => {
    if (/kakao|appkey|도메인|dapi/i.test(m.text())) kakaoErrors.push(`[${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => { if (/kakao|appkey|도메인/i.test(e.message)) kakaoErrors.push(`[err] ${e.message}`); });
  page.on("response", async (r) => {
    if (!r.url().includes("/api/recommend")) return;
    recStatus = r.status();
    try { const j = await r.json(); recCandidates = Array.isArray(j.candidates) ? j.candidates.length : null; recError = j.error; } catch {}
  });

  console.log(`→ smoke: ${BASE}\n`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  try { await page.waitForSelector('[aria-label="결과 단지 위치 지도"]', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);

  const dom = await page.evaluate(() => {
    const text = document.body.innerText || "";
    const map = document.querySelector('[aria-label="결과 단지 위치 지도"]');
    const has = (s) => text.includes(s);
    return {
      onResults: /(안정형|균형형|도전형)/.test(text),
      mapDiv: !!map,
      mapTiles: !!map && (!!map.querySelector("img") || !!map.querySelector("canvas")),
      kakaoLoaded: !!(window.kakao && window.kakao.maps),
      saveBanner: has("이 결과 저장"),
      trendCard: has("시세 흐름") || has("예산대"),
      // GA 는 gtag 스크립트 태그로 판별(있으면 env 설정됨).
      gaOn: !!document.querySelector('script[src*="googletagmanager.com/gtag"]'),
    };
  });

  const gaOn = dom.gaOn;
  // Vercel Web Analytics 는 플랫폼 엔드포인트 200 여부로 판별(클라 주입 타이밍보다 안정).
  // 브라우저 컨텍스트 요청을 써서 종료 시 dangling 소켓(libuv assertion)을 피한다.
  let vercelOn = false;
  try {
    const r = await page.request.get(`${BASE}/_vercel/insights/script.js`);
    vercelOn = r.status() === 200;
  } catch {}

  // ── 리포트 ──
  const rows = [];
  const core = (name, ok, note) => rows.push({ kind: "CORE", name, ok, note });
  const info = (name, ok, note) => rows.push({ kind: "INFO", name, ok, note });

  core("recommend API 200 + 후보>0", recStatus === 200 && (recCandidates || 0) > 0,
    `status=${recStatus} candidates=${recCandidates}${recError ? " error=" + recError : ""}`);
  core("결과화면 렌더(티어)", dom.onResults, "");
  core("미니맵 div", dom.mapDiv, "");
  core("미니맵 지도 타일 렌더(=도메인 인증)", dom.mapTiles && dom.kakaoLoaded, `kakaoLoaded=${dom.kakaoLoaded}`);
  core("카카오 콘솔 도메인 에러 0", kakaoErrors.length === 0, kakaoErrors.length ? kakaoErrors[0] : "");
  info("구글 애널리틱스(GA4)", gaOn, gaOn ? "on" : "off — NEXT_PUBLIC_GA_MEASUREMENT_ID 미설정");
  info("Vercel Analytics", vercelOn, vercelOn ? "on" : "off");
  info("결과 저장 배너(R1)", dom.saveBanner, "");
  info("내 예산대 시세 흐름(R3)", dom.trendCard, "");

  let coreFail = 0;
  for (const r of rows) {
    const mark = r.ok ? "✅" : r.kind === "CORE" ? "❌" : "➖";
    if (!r.ok && r.kind === "CORE") coreFail++;
    console.log(`${mark} [${r.kind}] ${r.name}${r.note ? "  — " + r.note : ""}`);
  }
  console.log(`\n${coreFail === 0 ? "✅ SMOKE PASS" : `❌ SMOKE FAIL (CORE ${coreFail}건)`}`);

  await browser.close();
  process.exit(coreFail === 0 ? 0 : 1);
})().catch((e) => { console.error("smoke 오류:", e); process.exit(2); });
