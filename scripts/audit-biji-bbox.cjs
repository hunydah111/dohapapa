// 기존 비지 PNG 전수검사 — 알파 bbox vs 파일 dimension 비교, 빈공간 있는 자산 발견.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DIR = path.resolve(__dirname, "..", "public", "biji");
const FLAG_PCT = 0.03; // 양 면에서 3% 이상 빈공간이면 flag

async function audit(file) {
  const src = path.join(DIR, file);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 120) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
  }
  if (bx1 < 0) return { file, status: "EMPTY", w, h };
  const left = bx0, right = w - 1 - bx1, top = by0, bottom = h - 1 - by1;
  const maxSide = Math.max(left, right, top, bottom);
  const pct = maxSide / Math.max(w, h);
  const flag = pct > FLAG_PCT ? "⚠ FLAG" : "✓ OK";
  return { file, status: flag, w, h, bx0, by0, bx1, by1, left, right, top, bottom, pct: (pct * 100).toFixed(1) + "%" };
}

(async () => {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith(".png") && !f.startsWith("_"));
  const results = await Promise.all(files.map(audit));
  results.sort((a, b) => (b.pct ? parseFloat(b.pct) : 0) - (a.pct ? parseFloat(a.pct) : 0));
  console.log("file | size | flag | empty L/R/T/B (px) | worst%");
  console.log("---");
  for (const r of results) {
    if (r.status === "EMPTY") { console.log(`${r.file.padEnd(28)} ${r.w}×${r.h} EMPTY`); continue; }
    console.log(`${r.file.padEnd(28)} ${r.w}×${r.h}  ${r.status}  L${r.left} R${r.right} T${r.top} B${r.bottom}  worst=${r.pct}`);
  }
  const flagged = results.filter(r => r.status?.includes("FLAG"));
  console.log(`\n총 ${files.length}개 중 ${flagged.length}개 FLAG (>${FLAG_PCT * 100}% 빈공간)`);
})();
