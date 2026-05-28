// 비지 tier 이미지 — 원본 jpg를 alpha 처리 없이 그대로 png로 변환.
// flood-fill 했을 때 흰 수트가 투명화·dark recolor로 망가지던 문제 해소.
// 카드 디자인은 비지 영역에 흰 배경 박스를 깔아주므로 jpg의 흰 bg 그대로 표시.

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.resolve(__dirname, "..", "assets", "biji-master", "incoming", "_processed");
const DST_DIR = path.resolve(__dirname, "..", "public", "biji", "tier");
// 처리 대상은 _processed/ 안의 tier-*.jpg 자동 감지. 새 변주 추가 시 _processed에 떨구기만 하면 됨.
// 단, 옛 폐기 등급(fever/justin/nan/top)은 제외.
const LEGACY_EXCLUDE = new Set(["fever", "justin", "nan", "top"]);
const TARGETS = fs.readdirSync(SRC_DIR)
  .map(f => {
    const m = f.match(/^tier-(.+)\.jpe?g$/i);
    return m ? m[1] : null;
  })
  .filter(slug => slug && !LEGACY_EXCLUDE.has(slug));

(async () => {
  for (const slug of TARGETS) {
    const src = path.join(SRC_DIR, `tier-${slug}.jpg`);
    const dst = path.join(DST_DIR, `${slug}.png`);
    if (!fs.existsSync(src)) {
      console.log(`${slug.padEnd(8)} MISSING source: ${src}`);
      continue;
    }
    // jpg → png (alpha 없음, 흰 배경 그대로). 1024×1024 정사각 보존.
    // sharp는 png 변환 시 원본 해상도 유지. resize 안 하면 Recraft 1024×1024 그대로.
    const buf = await sharp(src).png({ compressionLevel: 9 }).toBuffer();
    fs.writeFileSync(dst, buf);
    const meta = await sharp(dst).metadata();
    const sizeKb = (buf.length / 1024).toFixed(1);
    console.log(`${slug.padEnd(8)} ${meta.width}×${meta.height}  ${sizeKb} KB → ${path.relative(path.resolve(__dirname, ".."), dst)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
