// 일회성 스크린샷 도구 — 디자인 반복 검증용. node scripts/shot.cjs [url] [out] [w] [h] [full]
const { chromium } = require("playwright");
(async () => {
  const url = process.argv[2] || "http://localhost:3000";
  const out = process.argv[3] || "shot.png";
  const w = parseInt(process.argv[4] || "390", 10);
  const h = parseInt(process.argv[5] || "844", 10);
  const full = process.argv[6] === "full";
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(900); // 폰트·등장 모션 안정화
  await page.screenshot({ path: out, fullPage: full });
  await browser.close();
  console.log(`shot -> ${out}  ${w}x${h}${full ? " (full)" : " (fold)"}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
