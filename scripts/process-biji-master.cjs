// 비집고 비지 마스터 자동 후처리
// assets/biji-master/incoming/ 안의 jpg/png를 일괄 처리:
//   1) 코너 flood-fill (HARD 246) + 가장자리 페더링 (SOFT 210) → 투명 PNG (헤일로 없음)
//   2) alpha bbox 트림 → 4% pad → 정사각 캔버스 (512×512)
//   3) 파일명 규칙으로 출력 경로 결정:
//      - tier-{slug}.{jpg|png}      → public/biji/tier/{slug}.png
//      - accessory-{slug}.{jpg|png} → public/biji/accessory/{slug}.png
//      - chok-{slug}.{jpg|png}      → public/biji/chok/{slug}.png  (촉 게임 등급)
//      - persona-{slug}.{jpg|png}   → public/biji/persona/{slug}.png  (성향 테스트 유형)
//      - league-{slug}.{jpg|png}    → public/biji/league/{slug}.png  (동네 자랑 리그)
//      - 그 외                       → assets/biji-master/processed/{name}.png
//   4) 처리된 원본은 assets/biji-master/incoming/_processed/ 로 이동
//
// 사용: node scripts/process-biji-master.cjs
//
// 패턴 출처: scripts/process-biji-singles.cjs (기존 비지 처리법 v12)

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INCOMING = path.join(ROOT, "assets", "biji-master", "incoming");
const PROCESSED_BACKUP = path.join(INCOMING, "_processed");
const FALLBACK_OUT = path.join(ROOT, "assets", "biji-master", "processed");

const HARD = 246;        // 채널 평균 ≥ HARD = 배경 (완전 투명)
const SOFT = 210;        // 채널 평균 ≤ SOFT = 전경 (완전 불투명). 사이는 alpha 선형 페이드
const PAD_PCT = 0.04;    // bbox 외 4% padding
const OUT_SIZE = 512;    // 정사각 출력 한 변 (px)
const WEAK_ALPHA = 100;  // 이 이하 alpha = 완전 투명 (jpg 압축 노이즈 제거)

fs.mkdirSync(PROCESSED_BACKUP, { recursive: true });
fs.mkdirSync(FALLBACK_OUT, { recursive: true });

function classifyOutput(filename) {
  const stem = path.parse(filename).name.toLowerCase();
  // tier-fever.jpg → public/biji/tier/fever.png
  const tierMatch = stem.match(/^tier[-_](.+)$/);
  if (tierMatch) {
    const outDir = path.join(ROOT, "public", "biji", "tier");
    fs.mkdirSync(outDir, { recursive: true });
    return { outPath: path.join(outDir, `${tierMatch[1]}.png`), category: "tier", slug: tierMatch[1] };
  }
  // accessory-key.jpg → public/biji/accessory/key.png
  const accMatch = stem.match(/^accessory[-_](.+)$/);
  if (accMatch) {
    const outDir = path.join(ROOT, "public", "biji", "accessory");
    fs.mkdirSync(outDir, { recursive: true });
    return { outPath: path.join(outDir, `${accMatch[1]}.png`), category: "accessory", slug: accMatch[1] };
  }
  // chok-god.jpg → public/biji/chok/god.png (촉 게임 등급)
  const chokMatch = stem.match(/^chok[-_](.+)$/);
  if (chokMatch) {
    const outDir = path.join(ROOT, "public", "biji", "chok");
    fs.mkdirSync(outDir, { recursive: true });
    return { outPath: path.join(outDir, `${chokMatch[1]}.png`), category: "chok", slug: chokMatch[1] };
  }
  // persona-tiger.jpg → public/biji/persona/tiger.png (성향 테스트 유형)
  const personaMatch = stem.match(/^persona[-_](.+)$/);
  if (personaMatch) {
    const outDir = path.join(ROOT, "public", "biji", "persona");
    fs.mkdirSync(outDir, { recursive: true });
    return { outPath: path.join(outDir, `${personaMatch[1]}.png`), category: "persona", slug: personaMatch[1] };
  }
  // league-flag.jpg → public/biji/league/flag.png (동네 자랑 리그)
  const leagueMatch = stem.match(/^league[-_](.+)$/);
  if (leagueMatch) {
    const outDir = path.join(ROOT, "public", "biji", "league");
    fs.mkdirSync(outDir, { recursive: true });
    return { outPath: path.join(outDir, `${leagueMatch[1]}.png`), category: "league", slug: leagueMatch[1] };
  }
  // baseline 또는 그 외 → fallback
  return { outPath: path.join(FALLBACK_OUT, `${stem}.png`), category: "misc", slug: stem };
}

function floodAndFeather(data, w, h) {
  const brightness = (p) => (data[p] + data[p + 1] + data[p + 2]) / 3;
  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const v = y * w + x;
    if (visited[v]) return;
    visited[v] = 1;
    stack.push(v);
  };
  // 가장자리 전체 시드
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const v = stack.pop();
    const p = v * 4;
    if (brightness(p) < HARD) continue;
    data[p + 3] = 0;
    const x = v % w, y = (v / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // SOFT~HARD 사이 페더링
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (data[p + 3] === 0) continue;
    const b = brightness(p);
    if (b > SOFT) {
      const t = Math.min(1, (HARD - b) / (HARD - SOFT));
      data[p + 3] = Math.round(255 * Math.max(0, t));
    }
  }
  // 약한 alpha 클린업
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (data[p + 3] < WEAK_ALPHA) data[p + 3] = 0;
  }
}

function bbox(data, w, h) {
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 120) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
  }
  return [bx0, by0, bx1, by1];
}

async function processOne(filename) {
  const srcPath = path.join(INCOMING, filename);
  const { outPath, category, slug } = classifyOutput(filename);

  // 1) RAW RGBA 읽기
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  // 2) flood-fill + feather
  floodAndFeather(data, W, H);

  // 3) bbox 추출
  const [bx0, by0, bx1, by1] = bbox(data, W, H);
  if (bx1 < 0) {
    console.error(`  ⚠️ ${filename}: 콘텐츠 없음 (전부 투명)`);
    return false;
  }
  const cw = bx1 - bx0 + 1;
  const ch = by1 - by0 + 1;

  // 4) extract → extend로 4% pad → fit:contain resize로 정사각 (composite 우회로 안정)
  const pad = Math.round(Math.max(cw, ch) * PAD_PCT);
  const pngBuf = await sharp(Buffer.from(data), {
    raw: { width: W, height: H, channels: 4 },
  })
    .extract({ left: bx0, top: by0, width: cw, height: ch })
    .extend({
      top: pad, bottom: pad, left: pad, right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(OUT_SIZE, OUT_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // 한글 경로 안전성을 위해 toFile 대신 fs.writeFileSync
  fs.writeFileSync(outPath, pngBuf);

  // 5) 원본을 _processed/로 이동
  const backupPath = path.join(PROCESSED_BACKUP, filename);
  fs.renameSync(srcPath, backupPath);

  console.log(`  ✅ ${filename} → ${path.relative(ROOT, outPath)} [${category}/${slug}, bbox ${cw}×${ch}]`);
  return true;
}

(async () => {
  if (!fs.existsSync(INCOMING)) {
    console.error(`ERR: incoming 폴더 없음 → ${INCOMING}`);
    process.exit(1);
  }

  const files = fs.readdirSync(INCOMING)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .filter(f => !f.startsWith("_") && !f.startsWith("."));

  if (files.length === 0) {
    console.log("처리할 파일 없음 (incoming/ 비어있음)");
    console.log(`   파일 떨굴 곳: ${INCOMING}`);
    console.log(`   파일명 컨벤션: tier-{slug}.jpg / accessory-{slug}.jpg`);
    return;
  }

  console.log(`\n📦 처리 시작: ${files.length}개 파일\n`);
  let ok = 0, fail = 0;
  for (const f of files) {
    try {
      const r = await processOne(f);
      if (r) ok++; else fail++;
    } catch (e) {
      console.error(`  ❌ ${f}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\n완료: ✅ ${ok}개 | ⚠️ ${fail}개`);
  console.log(`처리된 원본은 ${path.relative(ROOT, PROCESSED_BACKUP)}/ 에 백업됨`);
})();
