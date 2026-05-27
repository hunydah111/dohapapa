// 비지 PNG 알파 침투 복원 — Recraft 출력 PNG에 flood-fill 적용 시 외곽선 anti-aliased
// 틈으로 들어간 *비지 본체* 픽셀이 alpha 0이 되는 문제. 사용자 보고("눈동자·귀가 빨갛다"
// = 부모 코랄이 알파 0 영역을 통과해 보임)의 진짜 원인.
//
// 복원 룰 (connected component 기반):
//   1. 외곽 4면에서 BFS — alpha 0 픽셀로만 이동해 visited mark
//   2. visited 안 된 alpha 0 픽셀 = 비지 외곽선에 갇힌 흰 영역 (눈 highlight·이빨·침투)
//   3. 갇힌 영역의 alpha 255 복원
// 외곽 배경(코너에 연결된 alpha 0)은 그대로 zero alpha.
//
// 재사용: 새 비지 PNG 추가 시 같은 룰. 사용법: npm run biji:restore

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DST = "public/biji";
const LIST = [
  "biji-clock-sigh", "biji-cheer-cocky", "biji-shrug-sigh", "biji-think-cool",
  "biji-crying-sigh", "biji-wallet-empty", "biji-running", "biji-car",
  "biji-transit", "biji-binoculars", "biji-smile-wave",
];

(async () => {
  for (const n of LIST) {
    const f = path.join(DST, n + ".png");
    if (!fs.existsSync(f)) { console.log(n.padEnd(22), "MISSING"); continue; }
    const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height;

    // 1) 외곽 4면 alpha 0 픽셀에서 BFS — alpha 0인 픽셀만 따라 이동해 visited mark
    const visited = new Uint8Array(w * h);
    const stack = [];
    const tryPush = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const v = y * w + x;
      if (visited[v]) return;
      if (data[v * 4 + 3] !== 0) return;
      visited[v] = 1;
      stack.push(v);
    };
    for (let x = 0; x < w; x++) { tryPush(x, 0); tryPush(x, h - 1); }
    for (let y = 0; y < h; y++) { tryPush(0, y); tryPush(w - 1, y); }
    while (stack.length) {
      const v = stack.pop();
      const x = v % w, y = (v / w) | 0;
      tryPush(x - 1, y); tryPush(x + 1, y); tryPush(x, y - 1); tryPush(x, y + 1);
    }
    // 2) visited 안 된 alpha 0 픽셀 = 비지 안 갇힌 흰 영역 → alpha 255 복원
    let restored = 0;
    for (let i = 0; i < w * h; i++) {
      if (!visited[i] && data[i * 4 + 3] === 0) {
        data[i * 4 + 3] = 255;
        restored++;
      }
    }
    // 3) weak alpha 클린업 — alpha 1-100 잔여 (외곽 anti-aliasing 약한 픽셀)는
    // 부모 색과 blend되어 흰점/허일로 효과를 만듦. 강제 zero alpha로 제거.
    let weakCleaned = 0;
    for (let i = 0; i < w * h; i++) {
      const a = data[i * 4 + 3];
      if (a > 0 && a < 100) {
        data[i * 4 + 3] = 0;
        weakCleaned++;
      }
    }
    // 4) 외곽 노이즈 dot 제거 — Recraft 출력 grain texture가 alpha 255+회색으로 남음.
    // alpha 255 픽셀의 connected component 분석 → 가장 큰 거(비지 본체)의 1% 미만은 노이즈.
    const cc = new Int32Array(w * h);
    const sizes = [0];
    let ccId = 0;
    for (let i = 0; i < w * h; i++) {
      if (data[i * 4 + 3] >= 200 && cc[i] === 0) {
        ccId++;
        sizes.push(0);
        const queue = [i];
        cc[i] = ccId;
        while (queue.length) {
          const v = queue.pop();
          sizes[ccId]++;
          const x = v % w, y = (v / w) | 0;
          const neigh = [[1,0],[-1,0],[0,1],[0,-1]];
          for (const [dx, dy] of neigh) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const nv = ny * w + nx;
            if (cc[nv] !== 0) continue;
            if (data[nv * 4 + 3] < 200) continue;
            cc[nv] = ccId;
            queue.push(nv);
          }
        }
      }
    }
    let maxSize = 0;
    for (let id = 1; id <= ccId; id++) if (sizes[id] > maxSize) maxSize = sizes[id];
    const minKeep = maxSize * 0.01; // 비지 본체의 1% 이상만 보존
    let dotsRemoved = 0;
    for (let i = 0; i < w * h; i++) {
      const id = cc[i];
      if (id > 0 && sizes[id] < minKeep) {
        data[i * 4 + 3] = 0;
        dotsRemoved++;
      }
    }
    // 5) 외곽 경계 anti-aliasing 페이드 픽셀 RGB → 외곽선 색(#3A1E0D)으로 교체.
    // alpha 1-254 + 인접에 alpha 0 픽셀 있음 = 진짜 외곽 가장자리. 비지 안 alpha 페이드는
    // 영향 X (인접 alpha 0 픽셀 없음). 부드러운 외곽선 유지 + 흰 잔여 제거.
    let edgeRecolored = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        const a = data[p + 3];
        if (a > 0 && a < 255) {
          let touchesZero = false;
          const neigh = [[1,0],[-1,0],[0,1],[0,-1]];
          for (const [dx, dy] of neigh) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (data[(ny * w + nx) * 4 + 3] === 0) { touchesZero = true; break; }
          }
          if (touchesZero) {
            data[p] = 58;
            data[p + 1] = 30;
            data[p + 2] = 13;
            edgeRecolored++;
          }
        }
      }
    }

    await sharp(data, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toFile(f + ".tmp");
    fs.renameSync(f + ".tmp", f);

    // 검증: 중앙 50% bbox holes + 코너 알파
    const { data: d2 } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d2[(y * w + x) * 4 + 3] > 200) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    const cx0 = minX + Math.floor((maxX - minX) * 0.25);
    const cx1 = minX + Math.floor((maxX - minX) * 0.75);
    const cy0 = minY + Math.floor((maxY - minY) * 0.25);
    const cy1 = minY + Math.floor((maxY - minY) * 0.75);
    let holes = 0, total = 0;
    for (let y = cy0; y <= cy1; y++) {
      for (let x = cx0; x <= cx1; x++) {
        total++;
        if (d2[(y * w + x) * 4 + 3] < 50) holes++;
      }
    }
    const cornerA =
      d2[3] +
      d2[(w - 1) * 4 + 3] +
      d2[(h - 1) * w * 4 + 3] +
      d2[((h - 1) * w + w - 1) * 4 + 3];
    const pct = ((holes / total) * 100).toFixed(1);
    const ok = holes / total < 0.02 && cornerA < 10;
    console.log(
      n.padEnd(22),
      "restored=" + restored.toString().padEnd(6),
      "weakClean=" + weakCleaned.toString().padEnd(6),
      "dots=" + dotsRemoved.toString().padEnd(5),
      "edge=" + edgeRecolored.toString().padEnd(5),
      "holes=" + pct + "%",
    );
  }
})().catch((e) => { console.error(e); process.exit(1); });
