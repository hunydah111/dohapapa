import type { Metadata } from "next";
import Link from "next/link";
import { serif, pretendard, PAPER, INK, INK_SOFT, RULE, CORAL } from "@/lib/paperTone";

// /원칙 — 편집 헌장 7조 + "우리가 하지 않는 것들" 공개 선언문 (#21, 2026-07-08).
// 미션 회의(2026-07-07) 액션 1. 원칙: 형용사 금지, 측정 가능한 것만 쓴다.
// 용도: ①신규 기능 심사 기준 ②"투기 조장" 공격에 대한 구조적 방패 ③언론 인용 근거.
// 정적 서버 컴포넌트 — 상태·인터랙션 0 (헌장 6조: 조작하지 않는다, 읽는다).

export const metadata: Metadata = {
  title: "원칙 — 비집고",
  description:
    "기록은 공공재다. 비집고의 편집 헌장 7조와 하지 않는 것들의 목록.",
  alternates: { canonical: "/principles" },
};

// ── 편집 헌장 7조 (2026-07-06 확립 · 7-06~07 6·7조 추가) ──────────────────
const CHARTER: { no: string; name: string; body: string }[] = [
  {
    no: "제1조",
    name: "인쇄되는 건 팩트뿐",
    body: "지면에는 국토부에 신고된 실거래 기록만 싣는다. 중위가 등 추정치는 기사 선별에만 쓰고 지면에 '시세'로 단정해 싣지 않는다.",
  },
  {
    no: "제2조",
    name: "숫자는 혼자 못 나온다",
    body: "모든 가격에는 기준점(직전 거래·기간 내 최고가)과 날짜를 병기한다. 직전 거래 비교의 유효기간은 60일이다.",
  },
  {
    no: "제3조",
    name: "사람 말로 쓴다",
    body: "“자기 시세를 웃돌았다”가 아니라 “최고가 갱신”으로 쓴다.",
  },
  {
    no: "제4조",
    name: "모든 정보엔 출구가 있다",
    body: "지면의 모든 동네·거래에서 “그래서 나는?”으로 이어지는 30초 판정 경로를 연결한다.",
  },
  {
    no: "제5조",
    name: "아래를 때리지 않는다",
    body: "하락은 동네 단위 익명 집계로만 다루고, 단지 실명 하락 랭킹은 만들지 않는다. 자랑을 유도하는 카피도 쓰지 않는다.",
  },
  {
    no: "제6조",
    name: "조작하지 않는다, 읽는다",
    body: "모든 화면은 조작 없이 완결된다. 인터랙션은 더 읽기와 판정 두 가지뿐이고, 설정은 평생 1회(내 동네 구독)다.",
  },
  {
    no: "제7조",
    name: "지면에는 예산이 있다",
    body: "1면은 한 호흡에 읽히는 분량을 지킨다. 코너를 늘릴 때는 접거나 요일제로 옮긴다.",
  },
];

// ── 하지 않는 것들 — 각 항목은 무엇을 포기했는지로 증명된다 ───────────────
const REFUSALS: { what: string; giveUp: string }[] = [
  { what: "하락 단지 실명 랭킹", giveUp: "조회수를 포기" },
  { what: "자랑 카드·자랑 공유 유도", giveUp: "바이럴을 포기" },
  { what: "호가·매물 정보", giveUp: "체류시간을 포기" },
  { what: "회원가입·개인정보 서버 저장", giveUp: "데이터 자산을 포기" },
  { what: "“시세” 단정·미래 가격 예측", giveUp: "단정의 화력을 포기" },
  { what: "투기 도구(호가 추적·수익률 계산기)", giveUp: "투기 수요 트래픽을 포기" },
  { what: "동네 서열 투표·유저 랭킹", giveUp: "참여 지표를 포기" },
  { what: "확인 안 된 급등 헤드라인(오보 게이트)", giveUp: "헤드라인 화력을 포기" },
];

const PILLARS: { name: string; body: string }[] = [
  {
    name: "번역",
    body: "국토부 실거래 기록을 매일 아침 지면·동네면·판정의 언어로 옮긴다. 놓친 정책대출 자격 안내를 포함한다.",
  },
  {
    name: "감시",
    body: "계약 해제를 지면에 기록하고, 직거래를 구분하고, 걸러낸 건수를 공시한다.",
  },
  {
    name: "공평",
    body: "수도권 전 시군구를 행정 구획 기준으로 동등하게 보도한다. 무료·무가입·무저장이다.",
  },
];

export default function PrinciplesPage() {
  return (
    <div style={{ background: PAPER }}>
      <article className="mx-auto max-w-2xl px-4 pb-20 pt-10" style={{ color: INK }}>
        {/* 제호 플레이트 + 제목 */}
        <header className="mb-8" style={{ borderBottom: `2.5px solid ${INK}` }}>
          <span
            className={`${pretendard.className} inline-block px-2 py-[3px] text-[12px] font-bold leading-none tracking-[0.06em]`}
            style={{ background: CORAL, color: PAPER }}
          >
            비집고
          </span>
          <h1
            className={`${serif.className} mt-3 text-3xl font-black tracking-tight sm:text-4xl`}
          >
            원칙
          </h1>
          <p className="mb-3 mt-2 text-[13px] leading-relaxed" style={{ color: INK_SOFT }}>
            2026-07-08 공개 · 개정 시 이 지면에 날짜와 함께 기록합니다
          </p>
        </header>

        {/* 미션 */}
        <section className="mb-9">
          <h2 className={`${serif.className} text-xl font-black`}>기록은 공공재다</h2>
          <p className="mt-2 text-[15px] leading-relaxed">
            국토부 실거래는 모두의 데이터지만, 읽는 능력은 소수의 것이었습니다.
            비집고는 그 기록을 모두의 언어로, 매일 아침, 무료로 번역합니다.
          </p>
          <div className="mt-4 space-y-2.5">
            {PILLARS.map((p) => (
              <p key={p.name} className="text-[14px] leading-relaxed">
                <b className={serif.className}>{p.name}.</b>{" "}
                <span style={{ color: INK_SOFT }}>{p.body}</span>
              </p>
            ))}
          </div>
        </section>

        {/* 편집 헌장 */}
        <section className="mb-9">
          <h2
            className={`${serif.className} border-t pt-5 text-xl font-black`}
            style={{ borderColor: RULE }}
          >
            편집 헌장
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: INK_SOFT }}>
            매일 새벽 자동 발행되는 모든 지면·동네면·판정이 이 일곱 조를 따릅니다.
            새 기능은 이 헌장을 통과해야 실립니다.
          </p>
          <ol className="mt-4 space-y-4">
            {CHARTER.map((c) => (
              <li key={c.no} className="text-[15px] leading-relaxed">
                <span className="text-[12px] font-bold" style={{ color: INK_SOFT }}>
                  {c.no}
                </span>{" "}
                <b className={serif.className}>{c.name}.</b>
                <span className="block pt-0.5 text-[14px]" style={{ color: INK_SOFT }}>
                  {c.body}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* 하지 않는 것들 */}
        <section className="mb-9">
          <h2
            className={`${serif.className} border-t pt-5 text-xl font-black`}
            style={{ borderColor: RULE }}
          >
            하지 않는 것들
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: INK_SOFT }}>
            원칙은 선언이 아니라 포기의 목록으로 증명됩니다.
          </p>
          <ul className="mt-4">
            {REFUSALS.map((r) => (
              <li
                key={r.what}
                className="flex items-baseline justify-between gap-3 border-b border-dotted py-2 text-[14px]"
                style={{ borderColor: RULE }}
              >
                <span>{r.what}</span>
                <span className="shrink-0 text-[12px]" style={{ color: INK_SOFT }}>
                  — {r.giveUp}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 데이터 명세 */}
        <section className="mb-10">
          <h2
            className={`${serif.className} border-t pt-5 text-xl font-black`}
            style={{ borderColor: RULE }}
          >
            데이터
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: INK_SOFT }}>
            국토교통부 실거래가 공개 API를 매일 새벽 폴링합니다. 신고는 계약 후 최대
            30일 지연되므로 지면은 항상 &ldquo;오늘 공개된&rdquo; 기준으로 씁니다. 계약 해제
            거래와 직거래는 집계에서 제외하고, 제외한 건수는 지면 하단에 공시합니다.
            판정 입력(소득·자산·직장)은 서버에 저장하지 않으며 브라우저에만 남습니다.
          </p>
        </section>

        {/* 출구 — 헌장 4조는 이 페이지에도 적용된다 */}
        <div className="border-t pt-5" style={{ borderColor: RULE }}>
          <Link
            href="/"
            className="inline-block px-4 py-2.5 text-[14px] font-bold"
            style={{ background: CORAL, color: PAPER }}
          >
            오늘의 지면 보기 →
          </Link>
        </div>
      </article>
    </div>
  );
}
