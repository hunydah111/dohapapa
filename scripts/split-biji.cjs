// 비지 합성 JPG → 개별 투명 PNG 분할기 (일회성 자산 처리)
// 가장자리에서 흰 배경을 flood-fill로 투명화 → 빈 칸(투명 컬럼/행) 기준 분할 → 트림 → PNG.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DIR = path.resolve(__dirname, "..", "public", "biji");
const OUT = path.join(DIR, "_split");
fs.mkdirSync(OUT, { recursive: true });

const WHITE = 236; // 채널 모두 이 값 이상이면 '배경 흰색'으로 간주
const FILL = 10; // 컬럼/행 불투명 픽셀 이 수 초과면 '내용 있음'(헤일로 잡음 무시)
const GAP = 12; // 이만큼 연속 빈칸이면 분할
const MINLEN = 50; // 이보다 좁은 세그먼트는 버림
const PADR = 0.06; // 트림 후 투명 여백 비율

const FILES = [
  { f: "운전비지 버스탄비지, 시계들고있는 비지.jpg", mode: "row", names: ["biji-car", "biji-transit", "biji-clock"] },
  { f: "지폐든 비지 계산기든비지 빈지갑보는 비지.jpg", mode: "row", names: ["biji-money", "biji-calc", "biji-wallet-empty"] },
  { f: "지도든 비지, 돋보기든 비지, 어께 으쓱하는 비지.jpg", mode: "row", names: ["biji-map", "biji-search", "biji-shrug"] },
  { f: "휴대폰들고 공유권하는비지.jpg", mode: "row", names: ["biji-share"] },
  { f: "한강변비지, 나무옆비지, 손흔들며인사비지, 집열쇠든 비지.jpg", mode: "grid", names: { "0,0": "biji-river", "1,0": "biji-tree", "0,1": "biji-wave", "1,1": "biji-key" } },
];

function floodBg(data, w, h) {
  const isWhite = (p) => data[p] >= WHITE && data[p + 1] >= WHITE && data[p + 2] >= WHITE;
  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const v = y * w + x; if (!visited[v]) { visited[v] = 1; stack.push(v); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const v = stack.pop(); const p = v * 4;
    if (!isWhite(p)) continue; // 흰색이 아니면 벽(전파 중단)
    data[p + 3] = 0; // 투명
    const x = v % w, y = (v / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
}

function segments(counts, n) {
  const segs = []; let s = -1, gap = 0;
  for (let i = 0; i < n; i++) {
    if (counts[i] > FILL) { if (s < 0) s = i; gap = 0; }
    else if (s >= 0) { gap++; if (gap >= GAP) { const e = i - gap; if (e - s + 1 >= MINLEN) segs.push([s, e]); s = -1; gap = 0; } }
  }
  if (s >= 0) { const e = n - 1; if (e - s + 1 >= MINLEN) segs.push([s, e]); }
  return segs;
}

function colCounts(data, w, X0, X1, Y0, Y1) {
  const c = new Int32Array(X1 - X0 + 1);
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) if (data[(y * w + x) * 4 + 3] > 0) c[x - X0]++;
  return c;
}
function rowCounts(data, w, X0, X1, Y0, Y1) {
  const r = new Int32Array(Y1 - Y0 + 1);
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) if (data[(y * w + x) * 4 + 3] > 0) r[y - Y0]++;
  return r;
}
function bbox(data, w, X0, Y0, X1, Y1) {
  let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) if (data[(y * w + x) * 4 + 3] > 0) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  return [bx0, by0, bx1, by1];
}
async function saveCrop(data, w, h, bx0, by0, bx1, by1, outPath) {
  const pad = Math.round(Math.max(bx1 - bx0, by1 - by0) * PADR);
  const x0 = Math.max(0, bx0 - pad), y0 = Math.max(0, by0 - pad), x1 = Math.min(w - 1, bx1 + pad), y1 = Math.min(h - 1, by1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) { const src = ((y0 + y) * w + x0) * 4; data.copy(out, y * cw * 4, src, src + cw * 4); }
  await sharp(out, { raw: { width: cw, height: ch, channels: 4 } }).png().toFile(outPath);
  return { cw, ch };
}

(async () => {
  for (const cfg of FILES) {
    const src = path.join(DIR, cfg.f);
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height;
    floodBg(data, w, h);
    const xsegs = segments(colCounts(data, w, 0, w - 1, 0, h - 1), w);
    console.log(`\n${cfg.f}  (${w}x${h})  xsegs=${JSON.stringify(xsegs)}`);
    if (cfg.mode === "row") {
      for (let c = 0; c < xsegs.length; c++) {
        const [x0, x1] = xsegs[c];
        const [bx0, by0, bx1, by1] = bbox(data, w, x0, 0, x1, h - 1);
        if (bx1 < 0) continue;
        const name = Array.isArray(cfg.names) ? cfg.names[c] : `cell-${c}`;
        const r = await saveCrop(data, w, h, bx0, by0, bx1, by1, path.join(OUT, name + ".png"));
        console.log(`  [col ${c}] ${name}.png  bbox=${bx0},${by0}-${bx1},${by1}  out=${r.cw}x${r.ch}`);
      }
    } else {
      // grid: x로 컬럼 나눈 뒤 각 컬럼 안에서 y로 행 나눔
      for (let c = 0; c < xsegs.length; c++) {
        const [x0, x1] = xsegs[c];
        const ysegs = segments(rowCounts(data, w, x0, x1, 0, h - 1), h);
        for (let rIdx = 0; rIdx < ysegs.length; rIdx++) {
          const [y0, y1] = ysegs[rIdx];
          const [bx0, by0, bx1, by1] = bbox(data, w, x0, y0, x1, y1);
          if (bx1 < 0) continue;
          const key = `${c},${rIdx}`;
          const name = cfg.names[key] || `cell-${key}`;
          const r = await saveCrop(data, w, h, bx0, by0, bx1, by1, path.join(OUT, name + ".png"));
          console.log(`  [${key}] ${name}.png  bbox=${bx0},${by0}-${bx1},${by1}  out=${r.cw}x${r.ch}`);
        }
      }
    }
  }
  console.log("\n완료 → public/biji/_split/");
})().catch((e) => { console.error(e); process.exit(1); });
