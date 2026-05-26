// 전수 비지 PNG retrim — 빈공간 자동 제거.
// 1. 각 PNG 알파 bbox (>120) 추출 → 3% pad으로 재트림 → public/biji/_retrim/ 저장
// 2. before/after 사본을 G드라이브 audit 폴더에 복사
// 3. 비교 HTML 생성
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DIR = path.resolve(__dirname, "..", "public", "biji");
const OUT = path.join(DIR, "_retrim");
const AUDIT = path.resolve("G:/내 드라이브/Claude작업/비집고_앱/_design-audit");
const BEFORE = path.join(AUDIT, "biji-before");
const AFTER = path.join(AUDIT, "biji-after");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(BEFORE, { recursive: true });
fs.mkdirSync(AFTER, { recursive: true });

const ALPHA_T = 120;
const PAD_PCT = 0.03;

async function retrim(file) {
  const src = path.join(DIR, file);
  const out = path.join(OUT, file);
  // 1단계: bbox 계산용으로 raw alpha 데이터만 읽음 (원본 픽셀 건드리지 않음).
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > ALPHA_T) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
  }
  if (bx1 < 0) return null;
  const pad = Math.round(Math.max(bx1 - bx0, by1 - by0) * PAD_PCT);
  const x0 = Math.max(0, bx0 - pad);
  const y0 = Math.max(0, by0 - pad);
  const x1 = Math.min(w - 1, bx1 + pad);
  const y1 = Math.min(h - 1, by1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  // 2단계: 무손실 crop — sharp의 extract API는 원본 픽셀을 그대로 옮김 (resample X, 색조정 X).
  // PNG 인코더는 lossless 포맷. compressionLevel 9 = 파일 크기만 최적, 픽셀값 영향 없음.
  await sharp(src)
    .ensureAlpha()
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .png({ compressionLevel: 9, palette: false })
    .toFile(out);
  return { file, w, h, cw, ch, savedW: w - cw, savedH: h - ch };
}

function htmlEscape(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

function makeHtml(changes) {
  const rows = changes
    .filter(r => r.savedW > 0 || r.savedH > 0)
    .sort((a, b) => (b.savedW + b.savedH) - (a.savedW + a.savedH))
    .map(r => `
      <div class="row">
        <div class="meta">
          <code>${htmlEscape(r.file)}</code>
          <span class="sz">${r.w}×${r.h} → <b>${r.cw}×${r.ch}</b></span>
          <span class="saved">−${r.savedW}×${r.savedH}px</span>
        </div>
        <div class="pair">
          <div class="cell"><span class="lbl before">Before</span><img src="biji-before/${r.file}" alt="" /></div>
          <div class="cell"><span class="lbl after">After</span><img src="biji-after/${r.file}" alt="" /></div>
        </div>
      </div>
    `).join("");

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8" /><title>비지 retrim 결과</title>
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet" />
<style>
  body { margin:0; font-family:Pretendard,sans-serif; background:#f5ecd9; padding:40px 24px; }
  h1 { font-size:28px; margin:0 0 6px; color:#3a2c1d; }
  .sub { color:#6e5b46; margin:0 0 24px; font-size:14px; }
  .row { background:white; border:1px solid rgba(70,48,24,0.12); border-radius:12px; padding:16px; margin-bottom:14px; }
  .meta { display:flex; gap:14px; align-items:baseline; margin-bottom:12px; font-size:13px; }
  .meta code { background:#fdf6e7; padding:3px 8px; border-radius:6px; font-weight:700; color:#3a2c1d; }
  .meta .sz { color:#6e5b46; }
  .meta .saved { color:#b87914; font-weight:700; margin-left:auto; }
  .pair { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .cell { position:relative; background:repeating-conic-gradient(#f0e8da 0% 25%, #fff 0% 50%) 50%/16px 16px; border-radius:8px; padding:8px; min-height:120px; display:flex; align-items:center; justify-content:center; }
  .cell img { max-width:100%; max-height:200px; display:block; }
  .lbl { position:absolute; top:6px; left:6px; font-size:10px; font-weight:700; padding:2px 7px; border-radius:999px; }
  .lbl.before { background:#f0e8da; color:#6e5b46; }
  .lbl.after { background:#b87914; color:white; }
</style></head>
<body>
  <h1>비지 retrim 결과 — Before / After</h1>
  <p class="sub">알파 bbox(>120) + 3% pad으로 재트림. 빈공간이 제거되면서 비지 자체 사이즈가 그대로 보임. 체크무늬 = 투명 영역.</p>
  ${rows}
</body></html>`;
}

(async () => {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith(".png") && !f.startsWith("_"));
  const results = [];
  for (const f of files) {
    const r = await retrim(f);
    if (r) {
      results.push(r);
      // before = 원본
      fs.copyFileSync(path.join(DIR, f), path.join(BEFORE, f));
      // after = retrimmed
      fs.copyFileSync(path.join(OUT, f), path.join(AFTER, f));
    }
  }
  const changed = results.filter(r => r.savedW > 0 || r.savedH > 0);
  console.log(`\n총 ${files.length}개 중 ${changed.length}개 retrim. 출력 → ${OUT}`);
  console.log("최대 절약 top 10:");
  for (const r of changed.sort((a, b) => (b.savedW + b.savedH) - (a.savedW + a.savedH)).slice(0, 10)) {
    console.log(`  ${r.file.padEnd(28)} ${r.w}×${r.h} → ${r.cw}×${r.ch}  saved ${r.savedW}×${r.savedH}`);
  }
  const htmlPath = path.join(AUDIT, "_retrim-preview.html");
  fs.writeFileSync(htmlPath, makeHtml(changed), "utf8");
  console.log(`\n비교 HTML → ${htmlPath}`);
})();
