// 비지 tier PNG 알파 복원 — public/biji/tier/{queen,rain,bieber}.png
// restore-biji-alpha.cjs 와 동일 알고리즘이지만 tier/ 경로 지정. flood-fill이 외곽선
// 틈으로 새서 안쪽 흰 영역(수트·이빨·체인)이 투명된 거 복원 + 약한 alpha·grain 제거 +
// edge anti-aliasing 페이드 픽셀 → 외곽선 색 교체.

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DST = "public/biji/tier";
const LIST = ["queen", "rain", "bieber"];

(async () => {
  for (const n of LIST) {
    const f = path.join(DST, n + ".png");
    if (!fs.existsSync(f)) { console.log(n.padEnd(10), "MISSING"); continue; }
    const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height;

    // 1) 외곽 BFS — alpha 0 픽셀로만 이동
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
    // 2) 비지 안 갇힌 흰 영역 복원
    let restored = 0;
    for (let i = 0; i < w * h; i++) {
      if (!visited[i] && data[i * 4 + 3] === 0) {
        data[i * 4 + 3] = 255;
        restored++;
      }
    }
    // 3) weak alpha 클린업
    let weakCleaned = 0;
    for (let i = 0; i < w * h; i++) {
      const a = data[i * 4 + 3];
      if (a > 0 && a < 100) {
        data[i * 4 + 3] = 0;
        weakCleaned++;
      }
    }
    // 4) grain dot 제거 (CC < 본체 1%)
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
    const minKeep = maxSize * 0.01;
    let dotsRemoved = 0;
    for (let i = 0; i < w * h; i++) {
      const id = cc[i];
      if (id > 0 && sizes[id] < minKeep) {
        data[i * 4 + 3] = 0;
        dotsRemoved++;
      }
    }
    // 5) edge anti-aliasing → 외곽선 색(#3A1E0D)
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

    console.log(
      n.padEnd(10),
      "restored=" + restored.toString().padEnd(7),
      "weakClean=" + weakCleaned.toString().padEnd(6),
      "dots=" + dotsRemoved.toString().padEnd(5),
      "edge=" + edgeRecolored,
    );
  }
})().catch((e) => { console.error(e); process.exit(1); });
