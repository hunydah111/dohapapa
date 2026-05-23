#!/usr/bin/env node
// OG 썸네일 서버측 자동 검증 도구.
// 라이브 사이트가 스크래퍼(카카오톡 등) 시점에서 "현재 소스의 OG 버전" 이미지를
// 리다이렉트 없이 정상 제공하는지 한 번에 확인한다. 사람이 카톡에 공유해 보지 않아도
// 서버측 진실을 끝까지 검증할 수 있게 만든 게 목적.
//
// 사용법:  node scripts/og-check.mjs [baseUrl]      (기본 https://homenasia.kr)
//          npm run og:check
//
// 확인 항목:
//   1) 리다이렉트 체인 — http/https, apex가 www로 튕기지 않는지(카카오는 리다이렉트에 약함)
//   2) 스크래퍼(카카오 UA)가 읽는 og:image / og:title
//   3) 실제 이미지 — 상태코드·content-type·바이트·해상도(PNG)·내용 해시
//   4) 캐시를 한 번도 안 탄 fresh URL(?ogcheck=ts) 결과 = 순수 서버 진실
//   5) 로컬 OG_VERSION(소스) 대비 배포 반영 여부
//   + 이미지를 scripts/.og-preview/ 에 저장(직접 열어 눈으로 확인용)
//
// ⚠️ 검증 불가 영역(설계상): 카카오 서버의 URL별 캐시, 사용자 폰 카톡 앱의 로컬 캐시.
//    이 둘은 외부 상태라 서버에서 못 건드린다. 이 스크립트가 PASS면 "서버는 새 그림을
//    내보내고 있다"가 증명된 것이고, 그래도 폰에서 옛 그림이면 100% 폰/카카오 캐시다.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KAKAO_UA = "facebookexternalhit/1.1; kakaotalk-scrap/1.0";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.argv[2] || "https://homenasia.kr").replace(/\/+$/, "");
const HOST = new URL(BASE).host;
const APEX = HOST.replace(/^www\./, "");

const ok = (b) => (b ? "PASS" : "FAIL");
let allPass = true;
const fail = () => (allPass = false);

async function trace(url, max = 10) {
  const hops = [];
  let cur = url;
  for (let i = 0; i < max; i++) {
    let res;
    try {
      res = await fetch(cur, { redirect: "manual", headers: { "user-agent": KAKAO_UA } });
    } catch (e) {
      hops.push({ url: cur, status: "ERR", note: e.message });
      break;
    }
    const loc = res.headers.get("location");
    hops.push({ url: cur, status: res.status, location: loc });
    if (res.status >= 300 && res.status < 400 && loc) cur = new URL(loc, cur).toString();
    else break;
  }
  return hops;
}

async function getPage(url) {
  const res = await fetch(url, { redirect: "follow", headers: { "user-agent": KAKAO_UA } });
  return { status: res.status, finalUrl: res.url, text: await res.text() };
}

function meta(text, key) {
  const a = text.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`, "i"),
  );
  if (a) return a[1];
  const b = text.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  );
  return b ? b[1] : null;
}

async function checkImage(url) {
  const res = await fetch(url, { redirect: "follow", headers: { "user-agent": KAKAO_UA } });
  const buf = Buffer.from(await res.arrayBuffer());
  let dims = null;
  if (buf.length > 24 && buf.toString("ascii", 1, 4) === "PNG")
    dims = { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  return {
    status: res.status,
    finalUrl: res.url,
    type: res.headers.get("content-type"),
    size: buf.length,
    sha: createHash("sha256").update(buf).digest("hex").slice(0, 12),
    dims,
    buf,
  };
}

async function localVersion() {
  try {
    const src = await readFile(join(ROOT, "src/app/opengraph-image.tsx"), "utf8");
    const m = src.match(/OG_VERSION\s*=\s*["']([^"']+)["']/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const verOf = (u) => (u && u.match(/\/opengraph-image\/([^?#/]+)/)?.[1]) || null;

console.log(`\n=== OG CHECK · ${BASE} · ${new Date().toISOString()} ===\n`);

// 1) 리다이렉트 체인
console.log("[1] 리다이렉트 체인 (카카오는 리다이렉트에 약함 → apex가 200을 직접 줘야 안전)");
for (const u of [`http://${APEX}/`, `https://${APEX}/`, `https://www.${APEX}/`]) {
  const hops = await trace(u);
  const last = hops[hops.length - 1];
  const line = hops.map((h) => `${h.status}${h.location ? `→${h.location}` : ""}`).join("  ");
  console.log(`    ${u}\n      ${line}`);
  if (u === `https://${APEX}/`) {
    const direct = last.status === 200;
    if (!direct) fail();
    console.log(`      apex https 직접 200 서빙: ${ok(direct)}${direct ? "" : " (www로 튕김 — 카카오 스크랩 실패 위험)"}`);
  }
}

// 2~3) 스크래퍼 시점 og + 실제 이미지
console.log("\n[2] 스크래퍼(카카오 UA)가 읽는 메타");
const page = await getPage(`${BASE}/`);
const ogImage = meta(page.text, "og:image");
const ogTitle = meta(page.text, "og:title");
console.log(`    페이지: ${page.status} (final ${page.finalUrl})`);
console.log(`    og:title = ${ogTitle}`);
console.log(`    og:image = ${ogImage}`);
const dupes = (page.text.match(/property=["']og:image["']/gi) || []).length;
console.log(`    og:image 태그 개수: ${dupes} ${ok(dupes === 1)}`);
if (dupes !== 1) fail();

console.log("\n[3] 실제 OG 이미지");
let img = null;
if (ogImage) {
  img = await checkImage(ogImage);
  const good = img.status === 200 && /image\//.test(img.type || "");
  if (!good) fail();
  console.log(
    `    ${img.status} · ${img.type} · ${img.size.toLocaleString()} bytes · ${img.dims ? `${img.dims.w}×${img.dims.h}` : "??"} · sha ${img.sha}  ${ok(good)}`,
  );
} else {
  fail();
  console.log("    og:image 없음 FAIL");
}

// 4) fresh URL = 캐시 안 탄 순수 서버 진실
console.log("\n[4] 캐시 안 탄 fresh URL (?ogcheck=…) — 순수 서버 진실");
const fresh = await getPage(`${BASE}/?ogcheck=${Date.now()}`);
const freshImg = meta(fresh.text, "og:image");
const freshMatch = freshImg === ogImage;
console.log(`    fresh og:image = ${freshImg}`);
console.log(`    일반 URL과 동일: ${ok(freshMatch)}`);
if (!freshMatch) fail();

// 5) 배포 반영 여부 (로컬 소스 vs 라이브)
console.log("\n[5] 배포 반영 (로컬 OG_VERSION vs 라이브)");
const lv = await localVersion();
const dv = verOf(ogImage);
const synced = lv && dv && lv === dv;
console.log(`    로컬 소스 OG_VERSION = ${lv} · 라이브 og:image 버전 = ${dv}  →  ${synced ? "동기화됨 PASS" : "불일치/미반영 FAIL"}`);
if (!synced) fail();

// 이미지 저장 (직접 열어보기용)
if (img?.buf) {
  const dir = join(ROOT, "scripts/.og-preview");
  await mkdir(dir, { recursive: true });
  const out = join(dir, `og-${HOST}-v${dv || "x"}.png`);
  await writeFile(out, img.buf);
  console.log(`\n저장: ${out}`);
}

console.log(`\n=== 결과: ${allPass ? "✅ ALL PASS — 서버는 새 OG를 정상 제공 중" : "❌ FAIL 있음 — 위 항목 확인"} ===`);
console.log(
  allPass
    ? "서버측은 완벽. 그래도 폰 카톡에서 옛 그림이면 카카오 캐시/폰 로컬 캐시 문제(서버로 못 고침).\n"
    : "",
);
process.exit(allPass ? 0 : 1);
