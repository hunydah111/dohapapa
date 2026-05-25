// 정책·세제 변경 감지 (GitHub Actions 주간 cron 용).
// docs/policy-watch.md 의 값들을 Claude + web_search 로 공식 출처와 대조한다.
//  - 변경 감지 → .policy-watch-issue.md 작성 + GITHUB_OUTPUT result=changed (워크플로가 이슈 생성)
//  - 변경 없음 → src/lib/policyLoan.ts 의 POLICY_META.lastVerified 를 오늘로 갱신 + result=current
// 자동 코드수정은 하지 않는다(한도 오반영 방지) — 변경 시엔 사람이 이슈 보고 PR.
//
// 필요: 환경변수 ANTHROPIC_API_KEY. (선택) POLICY_WATCH_MODEL 로 모델 변경(기본 claude-opus-4-7).
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const MODEL = process.env.POLICY_WATCH_MODEL || "claude-opus-4-7";
const POLICY_FILE = "src/lib/policyLoan.ts";
const CHECKLIST_FILE = "docs/policy-watch.md";
const ISSUE_FILE = ".policy-watch-issue.md";

// 오늘 (KST, YYYY-MM-DD)
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
  console.log(`[output] ${key}=${value}`);
}

const checklist = readFileSync(CHECKLIST_FILE, "utf8");
const client = new Anthropic({ timeout: 600_000 }); // 웹서치 서버루프가 길 수 있어 넉넉히

const system = `너는 한국 부동산 정책·세제 팩트체커다. 아래 체크리스트의 각 값(정책대출 한도·소득요건·취득세·중개보수·DSR 등)을 web_search / web_fetch 로 공식 출처와 대조한다.
규칙:
- 보수적으로 판단한다. 공식 출처에서 "현재 코드값이 바뀌었다"는 명확한 근거를 찾은 경우에만 changed=true.
- 값을 지어내지 마라. 확인이 안 되면 verified=false, changed=false, note 에 사유를 적는다.
- 한도·세율은 시점 의존이라 단정하지 말 것.
- 출처는 가능한 공식(myhome.go.kr, hf.go.kr, wetax.go.kr, korea.kr, fsc.go.kr)을 우선한다.
- 맨 마지막에 지정된 JSON만 \`\`\`json 코드블록으로 출력한다.`;

const user = `오늘(KST): ${today}

# 체크리스트
${checklist}

# 할 일
각 항목을 공식 출처와 대조한 뒤, 설명을 적고 맨 마지막에 아래 형식의 JSON 하나만 \`\`\`json 코드블록으로 출력해라:
{
  "asOf": "${today}",
  "findings": [
    {"item": "신생아특례 디딤돌 한도", "codeValue": "4.0억", "officialValue": "4.0억", "changed": false, "verified": true, "sourceUrl": "https://www.myhome.go.kr/...", "note": ""}
  ],
  "summary": "한국어 1-2문장 요약"
}`;

const messages = [{ role: "user", content: user }];
let final = null;
for (let i = 0; i < 8; i++) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system,
    tools: [
      { type: "web_search_20260209", name: "web_search", max_uses: 12 },
      { type: "web_fetch_20260209", name: "web_fetch", max_uses: 8 },
    ],
    messages,
  });
  // 서버측 툴 루프가 10회 한도에 걸리면 pause_turn — 그대로 이어붙여 재요청.
  if (resp.stop_reason === "pause_turn") {
    messages.push({ role: "assistant", content: resp.content });
    continue;
  }
  final = resp;
  break;
}
if (!final) throw new Error("pause_turn 루프 소진 — 응답 못 받음");

console.log("usage:", JSON.stringify(final.usage));

const text = final.content
  .filter((b) => b.type === "text")
  .map((b) => b.text)
  .join("\n");

// 마지막 ```json 블록 파싱
const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
let result = null;
try {
  result = JSON.parse(blocks.length ? blocks[blocks.length - 1][1] : text);
} catch {
  result = null;
}

// 파싱 실패 = 사람이 봐야 함 → changed 취급
if (!result || !Array.isArray(result.findings)) {
  writeFileSync(
    ISSUE_FILE,
    `## ⚠️ 정책 팩트체크 결과 파싱 실패 (${today})\n\n자동 판별이 안 됐어요. 모델 원문을 확인하세요:\n\n${text}\n`,
  );
  setOutput("result", "changed");
  console.log("결과: 파싱 실패 → 이슈로 사람 검토 요청");
  process.exit(0);
}

const findings = result.findings;
const changed = findings.filter((f) => f.changed === true);

if (changed.length > 0) {
  const rows = findings
    .map(
      (f) =>
        `| ${f.changed ? "🔴" : f.verified ? "✅" : "❔"} | ${f.item} | ${f.codeValue ?? ""} | ${f.officialValue ?? ""} | ${f.sourceUrl ?? ""} | ${f.note ?? ""} |`,
    )
    .join("\n");
  const body = `## 🔴 정책·세제 변경 의심 (${today})

${result.summary ?? ""}

**변경 의심 ${changed.length}건** — 아래 출처 확인 후 \`docs/policy-watch.md\`의 해당 코드 상수 + \`src/lib/policyLoan.ts\`의 \`POLICY_META\`를 수정하는 PR을 올려주세요(자동 반영 안 함).

| 상태 | 항목 | 코드값 | 공식값(감지) | 출처 | 비고 |
|---|---|---|---|---|---|
${rows}

— policy-watch 자동 생성 (모델 ${MODEL})`;
  writeFileSync(ISSUE_FILE, body);
  setOutput("result", "changed");
  console.log(`결과: 변경 의심 ${changed.length}건 → 이슈 생성`);
} else {
  // 변경 없음 → 검증일 갱신(배지 정직 유지). 한도 상수는 건드리지 않음.
  const src = readFileSync(POLICY_FILE, "utf8");
  const updated = src.replace(
    /lastVerified:\s*"\d{4}-\d{2}-\d{2}"/,
    `lastVerified: "${today}"`,
  );
  if (updated !== src) writeFileSync(POLICY_FILE, updated);
  setOutput("result", "current");
  console.log(`결과: 변경 없음 → lastVerified ${today} 로 갱신`);
}
