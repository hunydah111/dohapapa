// 스냅샷 가격 무결성 감사 — price-first 핵심: 평형별 추정가가 신뢰 가능한가.
// build-snapshot 다시 구울 때마다 실행 권장(audit-budget와 같은 회귀 도구).
//   node scripts/audit-snapshot-prices.cjs
// 검사: ①면적-총가격 역전(큰 평형이 더 쌈·단일거래 fluke) ②평단가 outlier ③희박표본 ④면적 오라벨.
// exit 1 조건: 의심 역전(>15%) 또는 희박표본 비율이 임계 초과 — CI/pre-snapshot 게이트용.
const path = require("path");
const d = require(path.join(__dirname, "..", "src", "data", "complexSnapshot.json"));
const C = d.complexes;
const 억 = (n) => (n / 1e8).toFixed(2);

// 임계 — 데이터 품질 회귀 감지(현 baseline 기준 여유 둠).
const BIG_INV_PCT = 0.15; // 인접 평형 가격 낙폭 이 이상이면 "의심"
const MAX_BIG_INV = 200; // 의심 역전 이 이상이면 fail (현재 ~113)
const MAX_SPARSE_RATIO = 0.65; // count≤3 밴드 비율 이 이상이면 fail (현재 ~0.575)

let bands = 0, sparse1 = 0, sparse3 = 0, areaBad = 0, monoOK = 0, multiBand = 0;
const inv = [];
const ppmOut = [];

for (const c of C) {
  const ms = [...(c.medians || [])].filter((m) => m.medianKrw > 0).sort((a, b) => a.area - b.area);
  bands += ms.length;
  for (const m of ms) {
    if (m.count <= 1) sparse1++;
    if (m.count <= 3) sparse3++;
    if (m.area < 20 || m.area > 250) areaBad++;
  }
  if (ms.length < 2) continue;
  multiBand++;
  let mono = true;
  for (let i = 1; i < ms.length; i++) {
    if (ms[i].medianKrw < ms[i - 1].medianKrw) {
      mono = false;
      const drop = (ms[i - 1].medianKrw - ms[i].medianKrw) / ms[i - 1].medianKrw;
      inv.push({ name: c.name, sgg: c.sigungu, small: ms[i - 1], big: ms[i], drop });
    }
  }
  if (mono) monoOK++;
  const ppm = ms.map((m) => ({ m, v: m.medianKrw / m.area }));
  const med = [...ppm].sort((a, b) => a.v - b.v)[Math.floor(ppm.length / 2)].v;
  for (const p of ppm) {
    const dev = (p.v - med) / med;
    if (Math.abs(dev) > 0.4) ppmOut.push({ name: c.name, area: p.m.area, krw: p.m.medianKrw, dev, cnt: p.m.count });
  }
}

const bigInv = inv.filter((x) => x.drop > BIG_INV_PCT);
const sparseRatio = sparse3 / bands;

console.log(`=== 스냅샷 가격 무결성 감사 (생성 ${d.generatedAt || "?"}) ===`);
console.log(`단지 ${C.length} · 평형밴드 ${bands} · 다평형 단지 ${multiBand}`);
console.log(`\n[①] 면적-총가격 단조증가 ${monoOK}/${multiBand} (${(monoOK / multiBand * 100).toFixed(1)}%) · 역전쌍 ${inv.length} · 의심(>${BIG_INV_PCT * 100}%) ${bigInv.length}`);
inv.sort((a, b) => b.drop - a.drop).slice(0, 10).forEach((x) =>
  console.log(`    ${x.name}(${x.sgg}) ${x.small.area}㎡ ${억(x.small.medianKrw)}(cnt${x.small.count}) → ${x.big.area}㎡ ${억(x.big.medianKrw)}(cnt${x.big.count})  -${(x.drop * 100).toFixed(0)}%`));
console.log(`\n[②] 평단가 outlier(±40%): ${ppmOut.length}`);
console.log(`[③] 희박표본 count≤1: ${sparse1} · count≤3: ${sparse3}/${bands} (${(sparseRatio * 100).toFixed(1)}%)`);
console.log(`[④] 면적 오라벨(<20·>250㎡): ${areaBad}`);

const fails = [];
if (bigInv.length > MAX_BIG_INV) fails.push(`의심 역전 ${bigInv.length} > ${MAX_BIG_INV}`);
if (sparseRatio > MAX_SPARSE_RATIO) fails.push(`희박표본 비율 ${(sparseRatio * 100).toFixed(1)}% > ${MAX_SPARSE_RATIO * 100}%`);
if (fails.length) {
  console.log(`\n✗ 데이터 품질 임계 초과: ${fails.join(" · ")}`);
  process.exit(1);
}
console.log(`\n✅ 임계 내 — 의심 역전 ≤${MAX_BIG_INV}, 희박표본 ≤${MAX_SPARSE_RATIO * 100}%. (대부분 역전은 단일거래 fluke·rep평형 사용으로 완화)`);
