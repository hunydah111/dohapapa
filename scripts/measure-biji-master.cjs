// 비집고 Geometry Master 자동 측정 — baseline 이미지(정면 비지)의 픽셀 단위 비율·색 추출.
// 출력: 콘솔 YAML + .claude/skills/biji-design/biji-style-bible.generated.yml
//
// 사용:
//   node scripts/measure-biji-master.cjs <baseline-image-path>
//   예) node scripts/measure-biji-master.cjs "C:/Users/User/OneDrive/Desktop/비버/baseline-front-biji.png"
//
// 의존: sharp (이미 설치됨, retrim-biji.cjs와 공유)
//
// 측정 항목:
//   1) 캐릭터 bbox (head 끝~발 끝) → total_height_px, total_width_px
//   2) 가로 width profile → 머리/몸 경계 (목) → head_height, body_height, head_to_body_ratio
//   3) 머리 단면에서 head_width (최대 가로 폭)
//   4) Top 7 dominant colors (히스토그램 quantize + RGB 거리 머지)
//   5) 검정 픽셀 (눈+코) 영역 → eye centroid·diameter·spacing
//   6) 코랄 핑크 픽셀 (볼) → cheek diameter·position·spacing
//   7) 결과를 head_width %로 정규화 (정량 spec)

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC = process.argv[2];
if (!SRC) {
  console.error("ERR: 인자로 baseline 이미지 경로 필요");
  console.error("예: node scripts/measure-biji-master.cjs \"C:/Users/.../baseline-front-biji.png\"");
  process.exit(1);
}
if (!fs.existsSync(SRC)) {
  console.error(`ERR: 파일 없음 → ${SRC}`);
  process.exit(1);
}

const BG_DISTANCE_THRESHOLD = 30; // 흰 배경(#FFFFFF)에서 RGB 거리 > 30이면 캐릭터
const COLOR_QUANTIZE = 16; // dominant color: 16 단위로 양자화
const COLOR_MERGE_DISTANCE = 28; // 비슷한 색 머지 거리
const TOP_COLORS_N = 8;

// ── 유틸 ────────────────────────────────────────────────────
function rgbDist(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
function hex(rgb) {
  return "#" + rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}
function isCharacterPixel(r, g, b) {
  return rgbDist([r, g, b], [255, 255, 255]) > BG_DISTANCE_THRESHOLD;
}
// 색 거리 분류용
function nearBlack(r, g, b) { return r < 70 && g < 60 && b < 60; }
function nearCoralBlush(r, g, b) {
  // 분홍/연한 코랄: 빨강 높고, 녹 < 빨강, 파랑 < 녹 정도
  return r > 220 && g > 140 && g < 200 && b > 130 && b < 200 && (r - g) > 30;
}

// ── 측정 본체 ───────────────────────────────────────────────
(async () => {
  console.log(`\n📷 측정 시작: ${SRC}`);

  const img = sharp(SRC);
  const meta = await img.metadata();
  const W = meta.width, H = meta.height;
  console.log(`   해상도: ${W} × ${H}`);

  // RAW RGB(A) — alpha 무시, jpg/png 무관하게 RGB만.
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const stride = info.channels; // 3 (RGB)

  // ── 1) 캐릭터 bbox + per-row width 프로파일 ──────────────
  let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
  const rowWidth = new Int32Array(H);     // 각 row의 캐릭터 픽셀 개수
  const rowLeft = new Int32Array(H);      // 각 row 최좌
  const rowRight = new Int32Array(H);     // 각 row 최우
  rowLeft.fill(W); rowRight.fill(-1);

  for (let y = 0; y < H; y++) {
    let count = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * stride;
      if (isCharacterPixel(data[i], data[i + 1], data[i + 2])) {
        count++;
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
        if (y < by0) by0 = y; if (y > by1) by1 = y;
        if (x < rowLeft[y]) rowLeft[y] = x;
        if (x > rowRight[y]) rowRight[y] = x;
      }
    }
    rowWidth[y] = count;
  }

  if (bx1 < 0) {
    console.error("ERR: 캐릭터 픽셀 0 — 이미지가 거의 다 흰색이거나 임계값 너무 큼");
    process.exit(2);
  }

  const totalH = by1 - by0 + 1;
  const totalW = bx1 - bx0 + 1;
  console.log(`   캐릭터 bbox: (${bx0},${by0}) → (${bx1},${by1}) = ${totalW} × ${totalH} px`);

  // ── 2) 머리/몸 분리: 머리는 위쪽 ~40% 영역에서 가장 넓은 곳, 목은 머리 아래 width 골짜기 ──
  // 머리 최대 폭 위치 (대략 머리 중심 y)
  let headPeakY = by0, headPeakW = 0;
  for (let y = by0; y < by0 + Math.round(totalH * 0.55); y++) {
    const w = rowRight[y] - rowLeft[y] + 1;
    if (rowWidth[y] > 0 && w > headPeakW) { headPeakW = w; headPeakY = y; }
  }
  const headWidth = headPeakW;
  console.log(`   머리 최대 폭(y=${headPeakY}): ${headWidth} px`);

  // 목 = headPeakY 아래로 내려가며 width 가장 좁은 곳
  let neckY = headPeakY, neckW = headPeakW;
  for (let y = headPeakY + 1; y < Math.min(by0 + Math.round(totalH * 0.7), H); y++) {
    const w = rowRight[y] - rowLeft[y] + 1;
    if (rowWidth[y] > 0 && w < neckW) { neckW = w; neckY = y; }
  }
  // 골짜기 검증: 너무 위면 신뢰 낮음
  const headHeight = neckY - by0 + 1;
  const bodyHeight = by1 - neckY;
  console.log(`   목 위치 y=${neckY} (가로 ${neckW} px) — head ${headHeight}px / body ${bodyHeight}px`);

  // ── 3) Dominant colors (16단위 quantize 히스토그램) ──────
  const hist = new Map();
  for (let y = by0; y <= by1; y++) {
    for (let x = rowLeft[y]; x <= rowRight[y]; x++) {
      const i = (y * W + x) * stride;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (!isCharacterPixel(r, g, b)) continue;
      const qr = Math.round(r / COLOR_QUANTIZE) * COLOR_QUANTIZE;
      const qg = Math.round(g / COLOR_QUANTIZE) * COLOR_QUANTIZE;
      const qb = Math.round(b / COLOR_QUANTIZE) * COLOR_QUANTIZE;
      const key = (qr << 16) | (qg << 8) | qb;
      hist.set(key, (hist.get(key) || 0) + 1);
    }
  }
  const sortedColors = [...hist.entries()]
    .map(([k, c]) => ({ rgb: [(k >> 16) & 255, (k >> 8) & 255, k & 255], count: c }))
    .sort((a, b) => b.count - a.count);

  // 비슷한 색 머지 — 거리 < COLOR_MERGE_DISTANCE
  const merged = [];
  for (const c of sortedColors) {
    let absorbed = false;
    for (const m of merged) {
      if (rgbDist(c.rgb, m.rgb) < COLOR_MERGE_DISTANCE) {
        // 가중 평균
        const total = m.count + c.count;
        m.rgb = m.rgb.map((v, i) => (v * m.count + c.rgb[i] * c.count) / total);
        m.count = total;
        absorbed = true;
        break;
      }
    }
    if (!absorbed) merged.push({ rgb: c.rgb.slice(), count: c.count });
    if (merged.length >= TOP_COLORS_N * 2) break;
  }
  const topColors = merged.slice(0, TOP_COLORS_N);

  // ── 4) 눈 + 코 영역 (검정 픽셀) — 머리 영역 내 검정 connected components ──
  const eyeMask = new Uint8Array(W * H);
  for (let y = by0; y <= neckY; y++) {
    for (let x = rowLeft[y]; x <= rowRight[y]; x++) {
      const i = (y * W + x) * stride;
      if (nearBlack(data[i], data[i + 1], data[i + 2])) eyeMask[y * W + x] = 1;
    }
  }
  const eyeComponents = findComponents(eyeMask, W, H, by0, neckY);
  // 큰 것 top 3 (눈 2 + 코 또는 입)
  eyeComponents.sort((a, b) => b.area - a.area);
  const top3 = eyeComponents.slice(0, 3);

  // ── 5) 볼 영역 (코랄 핑크) ────────────────────────────
  const cheekMask = new Uint8Array(W * H);
  for (let y = by0; y <= neckY; y++) {
    for (let x = rowLeft[y]; x <= rowRight[y]; x++) {
      const i = (y * W + x) * stride;
      if (nearCoralBlush(data[i], data[i + 1], data[i + 2])) cheekMask[y * W + x] = 1;
    }
  }
  const cheekComponents = findComponents(cheekMask, W, H, by0, neckY);
  cheekComponents.sort((a, b) => b.area - a.area);
  const cheeks = cheekComponents.slice(0, 2);

  // ── 6) 결과 정규화 (head_width 기준 %) ──────────────────
  const pct = (v, base = headWidth) => `${((v / base) * 100).toFixed(1)}%`;

  // 눈 분석: 큰 두 개 = 눈으로 추정, 그 사이 또는 위 = 코
  const eyes = top3.length >= 2 ? top3.slice(0, 2).sort((a, b) => a.cx - b.cx) : [];
  const eyeDiam = eyes.length ? Math.round((eyes[0].diameter + eyes[1].diameter) / 2) : 0;
  const eyeSpacing = eyes.length === 2 ? Math.abs(eyes[1].cx - eyes[0].cx) : 0;
  const eyeY = eyes.length ? Math.round((eyes[0].cy + eyes[1].cy) / 2) : 0;
  const eyeYFromHeadTop = eyeY - by0;

  const cheekDiam = cheeks.length ? Math.round((cheeks[0].diameter + (cheeks[1]?.diameter || cheeks[0].diameter)) / 2) : 0;

  // ── 출력 ────────────────────────────────────────────────
  const yaml = `# 비집고 Geometry Master 자동 측정 결과
# 측정 일시: ${new Date().toISOString()}
# 소스: ${SRC}
# 해상도: ${W} × ${H}
#
# ⚠️ 이 파일은 자동 생성. 수동 편집 금지 — 다시 측정하려면 measure-biji-master.cjs 재실행.

CANVAS:
  source_resolution: ${W}x${H}
  bg_color: "#FFFFFF"

CHARACTER_BBOX_PX:
  left: ${bx0}
  top: ${by0}
  right: ${bx1}
  bottom: ${by1}
  total_width: ${totalW}
  total_height: ${totalH}
  occupancy_height_pct: "${((totalH / H) * 100).toFixed(1)}%"

PROPORTIONS:
  head_width_px: ${headWidth}
  head_height_px: ${headHeight}
  body_height_px: ${bodyHeight}
  total_heads_tall: ${(totalH / headHeight).toFixed(2)}
  head_to_body_ratio: "1 : ${(bodyHeight / headHeight).toFixed(2)}"
  neck_y_px: ${neckY}
  neck_width_px: ${neckW}

# head_width 기준 정규화 (Nano Banana 프롬프트에 박을 정량 spec)
RELATIVE_TO_HEAD_WIDTH:
  total_height: "${pct(totalH)}"
  body_height: "${pct(bodyHeight)}"
  head_height: "${pct(headHeight)}"
${eyes.length ? `  eye_diameter: "${pct(eyeDiam)}"
  eye_spacing_centers: "${pct(eyeSpacing)}"
  eye_y_from_head_top: "${pct(eyeYFromHeadTop, headHeight)} of head_height"` : `  eyes: "측정 실패 (검정 영역 ${top3.length}개)"`}
${cheeks.length ? `  cheek_diameter: "${pct(cheekDiam)}"
  cheek_count: ${cheeks.length}` : `  cheeks: "측정 실패"`}

# Top ${TOP_COLORS_N} dominant colors (캐릭터 영역만, 픽셀 카운트 내림차순)
COLOR_PALETTE:
${topColors.map((c, i) => {
  const totalPx = topColors.reduce((s, x) => s + x.count, 0);
  const ratio = ((c.count / totalPx) * 100).toFixed(1);
  return `  - rank: ${i + 1}
    hex: "${hex(c.rgb)}"
    rgb: [${c.rgb.map(v => Math.round(v)).join(", ")}]
    ratio: "${ratio}%"
    likely: "${guessColorRole(c.rgb, i)}"`;
}).join("\n")}

# 측정 신뢰도 메모
NOTES:
  - "이 spec은 baseline 이미지 픽셀 측정 결과. 갸웃 비지(Style Master)가 아닌 정면 baseline 기준."
  - "head_width = 머리 가장 넓은 곳 가로 폭. eye_diameter = 검정 영역 connected component bbox 평균 가로/세로."
  - "color rank 1~3은 보통 보디 fur · 배 cream · outline. 4~6은 눈·코·볼·이빨. 직접 확인 권장."
  - "16개 프롬프트 작성 시 이 RELATIVE_TO_HEAD_WIDTH 섹션을 그대로 박는다."
`;

  console.log("\n" + yaml);

  // 파일로도 저장
  const outDir = path.resolve(__dirname, "..", ".claude", "skills", "biji-design");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "biji-style-bible.generated.yml");
  fs.writeFileSync(outPath, yaml, "utf8");
  console.log(`\n💾 저장됨: ${outPath}`);
  console.log("\n다음 단계: 이 YAML을 검토하고, 이상 없으면 prompts/01~16 자동 생성 시작.");
})();

// ── helpers ────────────────────────────────────────────────
function findComponents(mask, W, H, y0, y1) {
  const visited = new Uint8Array(W * H);
  const components = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!mask[idx] || visited[idx]) continue;
      // BFS
      let minX = x, maxX = x, minY = y, maxY = y, area = 0, sumX = 0, sumY = 0;
      const queue = [idx];
      visited[idx] = 1;
      while (queue.length) {
        const cur = queue.pop();
        const cx = cur % W, cy = (cur - cx) / W;
        area++; sumX += cx; sumY += cy;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
        const nb = [cur - 1, cur + 1, cur - W, cur + W];
        for (const n of nb) {
          if (n < 0 || n >= W * H) continue;
          if (visited[n] || !mask[n]) continue;
          // 같은 row 가장자리 wrap 방지
          if ((n === cur - 1 && cx === 0) || (n === cur + 1 && cx === W - 1)) continue;
          visited[n] = 1;
          queue.push(n);
        }
      }
      if (area < 30) continue; // 노이즈 무시
      components.push({
        area, bbox: [minX, minY, maxX, maxY],
        cx: sumX / area, cy: sumY / area,
        diameter: Math.max(maxX - minX, maxY - minY) + 1,
      });
    }
  }
  return components;
}

function guessColorRole(rgb, rank) {
  const [r, g, b] = rgb;
  if (r > 240 && g > 240 && b > 240) return "흰 배경 잔여 또는 이빨";
  if (r < 50 && g < 50 && b < 50) return "outline 또는 눈동공";
  if (r > 200 && g > 180 && b > 140) return "배 cream 또는 이빨";
  if (r > 150 && g > 100 && b < 100) return "보디 fur (브라운 톤)";
  if (r > 220 && g > 140 && g < 200 && b < 200) return "볼 블러시 (코랄 핑크)";
  if (rank === 0) return "주된 보디 색";
  return "확인 필요";
}
