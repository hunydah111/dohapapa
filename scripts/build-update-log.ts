// 데이터 업데이트 로그 빌더 — 매주 크론이 한 줄씩 쌓는 "살아있음 증거" 타임라인.
// 번들 dataMeta + leagueTable(이미 이번 주 재빌드됨)만 읽어 src/data/updateLog.json 에 엔트리 append.
// solo 운영자가 손 안 대도 매주 자동 누적 → /updates 페이지가 알아서 길어진다.
//
//   npx tsx scripts/build-update-log.ts   (build-data-meta·build-league 다음에 실행)
//
// 멱등: 같은 날짜 엔트리는 교체. 60주 넘으면 최근 60개만 유지(번들 비대 방지).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

interface Entry {
  date: string; // 갱신 실행일 YYYY-MM-DD (KST)
  latestDealDate: string; // 반영된 최신 실거래일
  txCount: number; // 누적 실거래 건수
  newTx: number | null; // 지난 엔트리 대비 증가분(첫 엔트리는 null)
  complexCount: number; // 수록 단지 수
  asOf: string; // 리그 기준월
  topMomentum: { sigungu: string; pct: number } | null; // 그 시점 최고 상승 동네
}

const LOG = resolve("src/data/updateLog.json");
const dm = JSON.parse(readFileSync(resolve("src/data/dataMeta.json"), "utf8"));
const lt = JSON.parse(readFileSync(resolve("src/data/leagueTable.json"), "utf8"));

const log: { entries: Entry[] } = existsSync(LOG)
  ? JSON.parse(readFileSync(LOG, "utf8"))
  : { entries: [] };

const now = new Date(); // 크론은 TZ=Asia/Seoul. 로컬 시드는 로컬 TZ(무방).
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

const mom = lt.regions.find((r: { ranks: { momentum: number } }) => r.ranks.momentum === 1);
const complexCount = lt.regions.reduce((s: number, r: { complexCount: number }) => s + r.complexCount, 0);
const prev = log.entries[log.entries.length - 1];
const newTx = prev ? dm.txCount - prev.txCount : null;

const entry: Entry = {
  date,
  latestDealDate: dm.latestDealDate,
  txCount: dm.txCount,
  newTx,
  complexCount,
  asOf: lt.asOf,
  topMomentum: mom ? { sigungu: mom.sigungu, pct: mom.momentumPct } : null,
};

const idx = log.entries.findIndex((e) => e.date === date);
if (idx >= 0) log.entries[idx] = entry;
else log.entries.push(entry);
if (log.entries.length > 60) log.entries = log.entries.slice(-60);

writeFileSync(LOG, JSON.stringify(log, null, 2) + "\n");
console.log(
  `updateLog.json: ${log.entries.length}개 엔트리 · 최신 ${date} · txCount ${dm.txCount.toLocaleString()} (+${newTx == null ? "첫 적재" : newTx.toLocaleString()})`,
);
