// 결과 페이지 자동 캡쳐 — 폼 자동입력 대신 #p= 레거시 base64url(JSON) 링크로 직접 결과 로드.
// 사용법: node scripts/shot-result.cjs [out-prefix]
const { chromium } = require("playwright");

const profile = {
  householdType: "dualIncome",
  priorities: { commute: 4, school: 3, buildingAge: 2, largeComplex: 3 },
  preferredAreaRanges: ["p32_35"],
  budgetMode: "detailed",
  householdIncomeKrwYear: 100000000,
  seedMoneyKrw: 300000000,
  netAssetsKrw: 300000000,
  existingLoanMonthlyKrw: 0,
  hasSchoolAgedChild: false,
  hasInfant: false,
  hasTwoOrMoreChildren: false,
  hasThreeOrMoreChildren: false,
  isExpectingChild: false,
  hasOwnedHomeBefore: false,
  isNewlywed: false,
  ownedHomeCount: 0,
  requiredRegions: ["수원시 권선구"],
  workplaceA: { label: "강남역", lat: 37.498, lng: 127.027, commuteMode: "car", maxCommuteMinutes: 60 },
  workplaceB: { label: "여의도", lat: 37.521, lng: 126.924, commuteMode: "car", maxCommuteMinutes: 60 },
};

function b64url(s) {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const slug = b64url(JSON.stringify(profile));
const url = `http://localhost:3000/#p=${slug}`;
const outPrefix = process.argv[2] || "shot-result";

(async () => {
  const browser = await chromium.launch();
  for (const [vp, w, h] of [["mobile", 390, 844], ["desktop", 1280, 900]]) {
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
    });
    await page.goto(url, { waitUntil: "networkidle" });
    // 결과 렌더링 + fade-in 모션 안정화
    await page.waitForSelector("section, h2", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const out = `${outPrefix}-${vp}.png`;
    await page.screenshot({ path: out, fullPage: true });
    console.log(`shot -> ${out}  ${w}x${h} (full)`);
    await page.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
