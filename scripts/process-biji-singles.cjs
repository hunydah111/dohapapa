// 단일 jpg → 투명 PNG (가장자리 페더링) — 신규 비지 D라운드 추가용.
// HARD/SOFT 임계로 헤일로 없이 부드럽게 가장자리 사라지게.
const sharp = require("sharp");
const path = require("path");

const SRC_DIR = path.resolve("C:/Users/User/OneDrive/Desktop/비버");
const OUT_DIR = path.resolve(__dirname, "..", "public", "biji");

const HARD = 246; // 채널 평균 이 값 이상 = 완전 투명 (배경)
const SOFT = 210; // 이 값 이하 = 완전 불투명 (전경). 사이는 alpha 선형 페이드
const PAD_DEFAULT = 0.04; // 정사각 비율 4% 여백
const PAD_TIGHT = 0.005;  // 도면비지 — 사용자 요청: 좌우 뚝 끊어서

const TASKS = [
  { src: "지도 비지.jpg", out: "biji-map.png", pad: PAD_DEFAULT },
  // 도면비지: 비지가 우측에 위치 — 좌측을 잘라 정사각(width=height)으로
  { src: "도면 비지.jpg", out: "biji-blueprint.png", pad: 0, cropWide: "left" },
  { src: "쌍안경 비지.jpg", out: "biji-binoculars.png", pad: PAD_DEFAULT },
];

function floodAndFeather(data, w, h) {
  const brightness = (p) => (data[p] + data[p + 1] + data[p + 2]) / 3;

  // 1) 가장자리에서 HARD 이상 밝기 픽셀을 flood-fill로 alpha 0 처리 (배경)
  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const v = y * w + x;
    if (visited[v]) return;
    visited[v] = 1;
    stack.push(v);
  };
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

  // 2) 잔여 밝은 가장자리 페더링 — SOFT~HARD 사이는 alpha 선형 감소 (헤일로 부드럽게)
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (data[p + 3] === 0) continue;
    const b = brightness(p);
    if (b > SOFT) {
      const t = Math.min(1, (HARD - b) / (HARD - SOFT));
      data[p + 3] = Math.round(255 * Math.max(0, t));
    }
  }

  // 3) 약한 알파 클린업 — jpg 압축 노이즈로 인한 weak alpha (< 100) 픽셀을 완전 투명화.
  // bbox 외곽 노이즈 제거 → 비지가 한쪽으로 쏠려 보이는 문제 해결.
  // (legit 가장자리 페더링은 SOFT~HARD 사이가 거의 다 < 100이라 일부 흡수될 수 있음 — trade-off)
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (data[p + 3] < 100) data[p + 3] = 0;
  }
}

function bbox(data, w, h) {
  // alpha 임계 120 — weak alpha 노이즈 완전 무시. 콘텐츠 가장자리(>100 alpha)만 bbox에 포함.
  let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 120) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
  }
  return [bx0, by0, bx1, by1];
}

// 디버깅: 우측 5컬럼·하단 5행의 alpha sum 출력 (노이즈 잔존 검증용)
function debugEdges(data, w, h) {
  const colSum = (x) => { let s = 0; for (let y = 0; y < h; y++) s += data[(y * w + x) * 4 + 3]; return s; };
  const rowSum = (y) => { let s = 0; for (let x = 0; x < w; x++) s += data[(y * w + x) * 4 + 3]; return s; };
  const right5 = [w-5, w-4, w-3, w-2, w-1].map(x => `x${x}=${colSum(x)}`).join(", ");
  console.log(`  edges: ${right5}`);
}

async function process(task) {
  const src = path.join(SRC_DIR, task.src);
  const out = path.join(OUT_DIR, task.out);
  console.log(`\n▶ ${task.src} → ${task.out}`);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  console.log(`  in: ${w}x${h}`);
  floodAndFeather(data, w, h);
  const [bx0, by0, bx1, by1] = bbox(data, w, h);
  if (bx1 < 0) throw new Error(`bbox empty for ${task.src}`);
  const pad = Math.round(Math.max(bx1 - bx0, by1 - by0) * task.pad);
  const x0 = Math.max(0, bx0 - pad);
  const y0 = Math.max(0, by0 - pad);
  const x1 = Math.min(w - 1, bx1 + pad);
  const y1 = Math.min(h - 1, by1 + pad);
  let cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  let outBuf = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const srcOff = ((y0 + y) * w + x0) * 4;
    data.copy(outBuf, y * cw * 4, srcOff, srcOff + cw * 4);
  }
  // 가로 > 세로일 때 한쪽 잘라 정사각(자연스러운 비율). 비지 위치에 따라 left/right.
  if (task.cropWide && cw > ch) {
    const cut = cw - ch;
    const newCw = ch;
    const cutLeft = task.cropWide === "left" ? cut : 0;
    const newBuf = Buffer.alloc(newCw * ch * 4);
    for (let y = 0; y < ch; y++) {
      const srcOff = (y * cw + cutLeft) * 4;
      outBuf.copy(newBuf, y * newCw * 4, srcOff, srcOff + newCw * 4);
    }
    outBuf = newBuf;
    cw = newCw;
    console.log(`  cropWide=${task.cropWide}: cut ${cut}px → ${cw}x${ch}`);
  }
  await sharp(outBuf, { raw: { width: cw, height: ch, channels: 4 } }).png().toFile(out);
  console.log(`  out: ${cw}x${ch}  bbox=[${bx0},${by0}-${bx1},${by1}]  pad=${pad}px`);
}

(async () => {
  for (const t of TASKS) await process(t);
  console.log("\n완료 → public/biji/");
})().catch((e) => { console.error(e); process.exit(1); });
