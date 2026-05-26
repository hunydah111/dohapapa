#!/usr/bin/env node
// 배포 전 검증 한 큐 — lint + typecheck + test + audit-budget.
// 실행: node scripts/preship.cjs
//
// WHY: 친구가 LTV 역전을 발견하는 식의 사후 버그 차단. 매 푸시 전 강제하면
// senstive 모듈(budget·policyLoan·capitalGainsTax·plan)의 회귀를 사전 감지.
// package.json은 의도적으로 안 건드림(미커밋 dev 추가물 보존) → 독립 스크립트.

const { spawnSync } = require("node:child_process");

const steps = [
  { name: "lint", cmd: "npm run lint" },
  { name: "typecheck", cmd: "npm run typecheck" },
  { name: "test", cmd: "npm test" },
  { name: "audit-budget (819+72 갈아타기+엣지)", cmd: "npx tsx scripts/audit-budget.ts" },
];

const t0 = Date.now();
let failed = null;

for (const s of steps) {
  process.stdout.write(`\n▶ ${s.name}…\n`);
  // 하드코딩 명령만 — 사용자 입력 없음(shell injection 위험 없음). shell:true는 Windows .cmd 호출용.
  const r = spawnSync(s.cmd, { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    failed = { step: s.name, status: r.status };
    break;
  }
  process.stdout.write(`✅ ${s.name} 통과\n`);
}

const dt = ((Date.now() - t0) / 1000).toFixed(1);
if (failed) {
  process.stdout.write(`\n=== ❌ preship 실패 (${failed.step}, exit ${failed.status}) — 푸시 중단 ===\n`);
  process.stdout.write(`   소요 ${dt}s · 위 출력에서 실패 원인 확인 후 수정 → 다시 실행\n`);
  process.exit(1);
}
process.stdout.write(`\n=== ✅ preship 통과 (${dt}s) — 푸시 안전 ===\n`);
