// 부동산 성향 비지 테스트 — 직교 2축(위험·가치) → 4유형. 순수·번들·DB0·No-PII.
// "MBTI"란 단어는 안 씀("내 부동산 성향 비지"). 유형이 겹치지 않게 2축으로 정의:
//   축① 위험: + 공격(영끌/레버리지) ↔ − 안정(내 돈만큼)
//   축② 가치: + 입지(브랜드·학군·역세권) ↔ − 실속(가성비·평단가)
// 각 축 5문항(±1) → 합이 홀수라 0(무승부) 불가능 → 사분면이 항상 깔끔하게 떨어짐.

export type Answer = "a" | "b";

export interface Choice {
  label: string;
  /** 한 축에만 ±1. */
  risk?: number;
  value?: number;
}
export interface Question {
  id: string;
  q: string;
  a: Choice;
  b: Choice;
}

// 10문항 = 위험 5 + 가치 5. (+risk=공격, +value=입지)
export const QUESTIONS: Question[] = [
  // ── 축① 위험 성향 ──
  { id: "r1", q: "10억짜리 집, 지금 사려면 5억 대출. 어떻게?",
    a: { label: "영끌해서라도 지금 산다", risk: +1 },
    b: { label: "2억 더 모아서 8억대로 간다", risk: -1 } },
  { id: "r2", q: "실거주는 나중, 지금은 돈이 좀 빠듯한데",
    a: { label: "전세 끼고 갭으로 미리 사둔다", risk: +1 },
    b: { label: "온전히 살 수 있을 때 산다", risk: -1 } },
  { id: "r3", q: "대출 금리가 확 올랐어",
    a: { label: "그래도 산다, 집값이 더 오를 텐데", risk: +1 },
    b: { label: "이자 무서워서 무리 안 한다", risk: -1 } },
  { id: "r4", q: "더 와닿는 말은?",
    a: { label: "지금 못 사면 평생 못 산다", risk: +1 },
    b: { label: "무리하면 한 방에 훅 간다", risk: -1 } },
  { id: "r5", q: "집값이 잠깐 출렁이면?",
    a: { label: "좋은 자리면 버틴다, 결국 오른다", risk: +1 },
    b: { label: "떨어질 것 같으면 안 산다", risk: -1 } },
  // ── 축② 가치 기준 ──
  { id: "v1", q: "같은 값이면?",
    a: { label: "역세권 25평 구축", value: +1 },
    b: { label: "외곽 34평 신축", value: -1 } },
  { id: "v2", q: "브랜드 대단지 vs 비브랜드",
    a: { label: "비싸도 브랜드 대단지", value: +1 },
    b: { label: "이름값 빼고 가성비", value: -1 } },
  { id: "v3", q: "학군 좋은 동네, 그만큼 더 비싸",
    a: { label: "교육 위해 더 낸다", value: +1 },
    b: { label: "학군값은 거품이다", value: -1 } },
  { id: "v4", q: "평단가가 동네 평균보다 좀 비싼 집",
    a: { label: "비싼 덴 이유가 있다, 입지값", value: +1 },
    b: { label: "거품 주고는 못 산다", value: -1 } },
  { id: "v5", q: "내 집을 고를 때 더 신경 쓰는 건?",
    a: { label: "남들이 알아주는 동네인지", value: +1 },
    b: { label: "남이 뭐라든 내 실속", value: -1 } },
];

export type PersonaId = "tiger" | "fox" | "owl" | "turtle";

export interface PersonaType {
  id: PersonaId;
  emoji: string;
  label: string;
  /** 극단(찐) 버전 라벨. */
  strongLabel: string;
  tagline: string;
  blurb: string;
  /** 실거래 톤의 한 줄 팩폭. */
  fact: string;
  /** 유형 비지 경로(없으면 emoji 폴백). public/biji/persona/<id>.png */
  image: string;
}

export const TYPES: Record<PersonaId, PersonaType> = {
  tiger: {
    id: "tiger", emoji: "🐯", label: "한방 호랑이", strongLabel: "영끌 불나방 호랑이",
    tagline: "공격 × 입지",
    blurb: "영끌해서라도 대장 아파트. 입지에 올인하는 공격수.",
    fact: "호랑이형이 노리는 건 보통 동네 상위 가격대 — 잘 맞으면 한 방, 빗나가면 이자가 한 방.",
    image: "/biji/persona/tiger.png",
  },
  fox: {
    id: "fox", emoji: "🦊", label: "가성비 여우", strongLabel: "프로 갈아타기 여우",
    tagline: "공격 × 실속",
    blurb: "저평가·갈아타기로 영리하게 굴리는 실속형 공격수.",
    fact: "여우형은 같은 예산으로 '덜 유명한데 더 넓은' 자리를 노린다 — 거품은 피하고 기회는 먹고.",
    image: "/biji/persona/fox.png",
  },
  owl: {
    id: "owl", emoji: "🦉", label: "똘똘한 부엉이", strongLabel: "입지 맹신 부엉이",
    tagline: "안정 × 입지",
    blurb: "무리 없이, 그러나 입지 좋은 똘똘한 한 채.",
    fact: "부엉이형은 '비싸도 검증된 입지'를 천천히 모아 간다 — 안전벨트 맨 입지파.",
    image: "/biji/persona/owl.png",
  },
  turtle: {
    id: "turtle", emoji: "🐢", label: "실속 거북이", strongLabel: "무리 없는 안정 거북이",
    tagline: "안정 × 실속",
    blurb: "빚은 무섭다. 천천히, 안전하게, 가성비로.",
    fact: "거북이형은 대출보다 내 돈, 이름값보다 평단가 — 느리지만 발 뻗고 잔다.",
    image: "/biji/persona/turtle.png",
  },
};

export interface PersonaResult {
  type: PersonaType;
  /** 어느 한 축이라도 강하게(±4↑) 치우치면 '찐'. */
  strong: boolean;
  risk: number; // + 공격 / − 안정
  value: number; // + 입지 / − 실속
}

/** 답안(10개) → 유형. 각 축 합이 홀수라 0 불가 → 사분면 항상 결정적. */
export function classify(answers: Answer[]): PersonaResult {
  let risk = 0;
  let value = 0;
  QUESTIONS.forEach((qu, i) => {
    const c = answers[i] === "b" ? qu.b : qu.a;
    risk += c.risk ?? 0;
    value += c.value ?? 0;
  });
  const id: PersonaId =
    risk > 0 ? (value > 0 ? "tiger" : "fox") : value > 0 ? "owl" : "turtle";
  const strong = Math.abs(risk) >= 4 || Math.abs(value) >= 4;
  return { type: TYPES[id], strong, risk, value };
}

/** 결과 표시용 라벨(찐이면 강한 라벨). */
export function personaLabel(r: PersonaResult): string {
  return r.strong ? r.type.strongLabel : r.type.label;
}
