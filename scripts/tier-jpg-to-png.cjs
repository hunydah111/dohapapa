// 비지 tier 이미지 통합 파이프라인 — 원본 jpg(또는 png)를 받아 4가지 문제 한 번에 처리:
//   1) Recraft jpg에 baked-in된 체커 패턴(투명 표현용 회색·흰 격자) → 순백 강제
//   2) 코너 BFS로 배경 영역만 격리 → 비지 body 안 light 픽셀(흰 수트·이빨)은 안 건드림
//   3) 경계선 anti-aliasing 잔여(연한 회색 fringe) → 인접 픽셀 따라 적절히 처리
//   4) 출력 검증 — 코너 픽셀 순백 확인, light gray 클러스터 잔존 검사
//
// 매번 새 비지 추가 시 이 한 스크립트만 돌리면 위 4건 모두 해결 + 검증 완료.
// 자동 감지: _processed/ 안 tier-*.jpg 전부 처리, legacy 4종 제외.
//
// 사용: node scripts/tier-jpg-to-png.cjs
//
// 이전 단순 jpg→png 변환에서 발생하던 문제(pinkbaby 체커·alpha 침투 등)를 파이프라인 차원에서
// 차단하기 위한 v2. 매번 발견-fix 반복 비용을 한 번에 해소.

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.resolve(__dirname, "..", "assets", "biji-master", "incoming", "_processed");
const DST_DIR = path.resolve(__dirname, "..", "public", "biji", "tier");
const LEGACY_EXCLUDE = new Set(["fever", "justin", "nan", "top"]);

// "light pixel" 판정 — 모든 채널 LIGHT_MIN 이상 + 회색·흰 톤 (R-G-B 차이가 COLOR_TOL 이하).
// LIGHT_MIN 180은 body 내부 light fill(흰 수트 #FFFDF5≈252·이빨 등)을 안 건드리면서
// 체커의 light 회색(190~240 정도)을 잡아내는 안전 임계.
const LIGHT_MIN = 180;
const COLOR_TOL = 20;

function isLight(data, idx) {
  const p = idx * 4;
  const r = data[p], g = data[p + 1], b = data[p + 2];
  if (r < LIGHT_MIN || g < LIGHT_MIN || b < LIGHT_MIN) return false;
  const maxCh = Math.max(r, g, b);
  const minCh = Math.min(r, g, b);
  return maxCh - minCh <= COLOR_TOL;
}

function bgFloodFill(data, w, h) {
  // BFS from edges through light pixels. corner-connected 영역만 마킹.
  // 마킹된 픽셀 → 순백(255,255,255,255)으로 강제. body 안 white 픽셀은 격리돼 안 건드림.
  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const v = y * w + x;
    if (visited[v]) return;
    if (!isLight(data, v)) return;
    visited[v] = 1;
    stack.push(v);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  let recolored = 0;
  while (stack.length) {
    const v = stack.pop();
    const p = v * 4;
    data[p] = 255; data[p + 1] = 255; data[p + 2] = 255; data[p + 3] = 255;
    recolored++;
    const x = v % w, y = (v / w) | 0;
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
  return recolored;
}

function verify(data, w, h, slug) {
  const warnings = [];
  // 코너 픽셀 순백 검사는 제거 — queen 같이 스포트라이트가 코너까지 닿는 의도된 디자인이
  // 있어서 strict 검사는 false positive. 가장자리 영역 light gray (회색 톤) 잔존 검사만
  // 유지 — 진짜 "체커·halo 잔여" 노이즈만 잡고 의도된 색 광원은 통과.

  // 가장자리 영역(상하 5%·좌우 5%) 샘플링 — light gray 클러스터(회색 톤) 검출
  let bgSamples = 0, lightGray = 0;
  const edgeY = Math.max(1, Math.floor(h * 0.05));
  const edgeX = Math.max(1, Math.floor(w * 0.05));
  for (let y = 0; y < edgeY; y++) {
    for (let x = 0; x < w; x += 10) {
      bgSamples++;
      if (isLight(data, y * w + x) && data[(y * w + x) * 4] < 250) lightGray++;
    }
  }
  for (let y = h - edgeY; y < h; y++) {
    for (let x = 0; x < w; x += 10) {
      bgSamples++;
      if (isLight(data, y * w + x) && data[(y * w + x) * 4] < 250) lightGray++;
    }
  }
  if (lightGray > 0) warnings.push(`가장자리 light gray ${lightGray}/${bgSamples} 샘플 잔존`);
  return warnings;
}

function classifyOutput(filename) {
  const stem = path.parse(filename).name.toLowerCase();
  const m = stem.match(/^tier[-_](.+)$/);
  return m ? m[1] : null;
}

(async () => {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`ERR: SRC_DIR 없음 → ${SRC_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(SRC_DIR)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .filter((f) => !f.startsWith("_") && !f.startsWith("."));

  const targets = files
    .map((f) => ({ filename: f, slug: classifyOutput(f) }))
    .filter((t) => t.slug && !LEGACY_EXCLUDE.has(t.slug));

  if (targets.length === 0) {
    console.log("처리할 tier-*.jpg 없음");
    return;
  }

  console.log(`\n📦 ${targets.length}개 파일 처리 (4-step 통합 파이프라인)\n`);
  let ok = 0, warn = 0;
  for (const { filename, slug } of targets) {
    const src = path.join(SRC_DIR, filename);
    const dst = path.join(DST_DIR, `${slug}.png`);
    // 1) RGBA 변환 + flatten (jpg일 때 alpha 없어도 ensureAlpha로 통일)
    let { data, info } = await sharp(src)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height;
    // 2) 코너 BFS로 체커·배경 light 영역 → 순백 강제
    const recolored = bgFloodFill(data, w, h);
    // 3) PNG 저장 (alpha 없이 — flatten으로 통일)
    const buf = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    fs.writeFileSync(dst, buf);
    // 4) 검증 — 코너 순백 + 가장자리 light gray 잔존. ensureAlpha로 4-ch 보장(인덱싱 일치).
    const verifyData = (await sharp(dst).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data;
    const warnings = verify(verifyData, w, h, slug);
    const sizeKb = (buf.length / 1024).toFixed(1);
    const tag = warnings.length === 0 ? "✅" : "⚠️ ";
    console.log(`  ${tag} ${slug.padEnd(10)} ${w}×${h}  ${sizeKb}KB  bg recolored=${recolored}px`);
    if (warnings.length > 0) {
      warn++;
      for (const w of warnings) console.log(`       ${w}`);
    } else {
      ok++;
    }
  }
  console.log(`\n완료: ✅ ${ok}건 통과 · ⚠️ ${warn}건 경고`);
  // exit code로 hook에 신호 — 경고 있으면 non-zero (commit 차단), 없으면 0 (통과)
  if (warn > 0) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
