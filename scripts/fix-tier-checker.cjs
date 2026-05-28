// 비지 tier 이미지의 baked-in 체커 패턴 제거 — 일부 Recraft jpg가 투명 표현을 위해
// 흰+연회색 체커를 픽셀로 박아놨음 (jpg는 alpha 없어서). BFS로 코너 연결 light 픽셀만
// 순백으로 복원 (비지 body 안 light 픽셀은 격리돼 안 건드림).
//
// 사용: node scripts/fix-tier-checker.cjs <slug1> [slug2] ...
// 예: node scripts/fix-tier-checker.cjs pinkbaby

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DST = path.resolve(__dirname, "..", "public", "biji", "tier");
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/fix-tier-checker.cjs <slug>...");
  process.exit(1);
}

// "light pixel" 정의 — 모든 채널이 LIGHT_MIN 이상이고 R-G-B 차이가 LOW (회색·흰색).
// 너무 LIGHT_MIN 낮추면 body 안 light fill까지 잡힘. 180은 안전 임계.
const LIGHT_MIN = 180;
const COLOR_TOL = 20; // R/G/B 채널 간 차이가 이 이하면 회색·흰 톤

(async () => {
  for (const slug of args) {
    const f = path.join(DST, `${slug}.png`);
    if (!fs.existsSync(f)) {
      console.log(`${slug.padEnd(10)} MISSING`);
      continue;
    }
    const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height;

    // BFS from corners through light pixels — corner-connected 영역만 흰색 복원.
    const visited = new Uint8Array(w * h);
    const stack = [];
    const isLight = (idx) => {
      const p = idx * 4;
      const r = data[p], g = data[p + 1], b = data[p + 2];
      if (r < LIGHT_MIN || g < LIGHT_MIN || b < LIGHT_MIN) return false;
      const maxCh = Math.max(r, g, b);
      const minCh = Math.min(r, g, b);
      return maxCh - minCh <= COLOR_TOL;
    };
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const v = y * w + x;
      if (visited[v]) return;
      if (!isLight(v)) return;
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
    // png로 다시 (3ch로 — alpha 없이 깔끔)
    const buf = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    fs.writeFileSync(f, buf);
    console.log(`${slug.padEnd(10)} ${w}×${h}  recolored=${recolored}px → ${path.relative(path.resolve(__dirname, ".."), f)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
