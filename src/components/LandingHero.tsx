import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { NeighborhoodChart } from "@/components/NeighborhoodChart";
import { PopularComplexChart } from "@/components/PopularComplexChart";
import dataMeta from "@/data/dataMeta.json";
import { POLICY_META } from "@/lib/policyLoan";

// 최근 실거래 반영일 — "2026-05-20" → "2026.5.20". 매일 크론이 dataMeta.json 을 갱신.
const FRESH_DATE: string | null = (() => {
  const d = dataMeta.latestDealDate;
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${y}.${Number(m)}.${Number(day)}`;
})();

// 정책(대출·세제) 점검 시점 — "2026-05-25" → "2026.5". 검색 전부터 기준일 노출(신뢰).
const POLICY_VERIFIED_SHORT: string = (() => {
  const [y, m] = POLICY_META.lastVerified.split("-");
  return `${y}.${Number(m)}`;
})();

// 첫 화면(랜딩) — 가치 제안 헤드라인 + 작은 비버 + "예시 결과" 미니카드 + 단일 CTA.
// 폼(가구유형 등)은 CTA 를 누른 뒤에 노출된다(폼 벽 제거).

function MiniBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#f3ece4] px-2.5 py-1 text-[11px] font-semibold text-[#6b6157]">
      {children}
    </span>
  );
}

export function LandingHero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative overflow-hidden px-1 pt-6 pb-4 text-center sm:pt-10">
      {/* 따뜻한 라디얼 워시 배경 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
        style={{
          background:
            "radial-gradient(58% 64% at 50% 10%, rgba(254,118,68,0.22) 0%, rgba(224,162,58,0.16) 38%, rgba(245,236,217,0) 72%)",
        }}
      />

      {/* 브랜드 히어로 — 한강에서 서울을 바라보며 '비집고' 들어갈 집을 그리는 비지 */}
      <div className="biji-pop-in -mx-1 mb-4 overflow-hidden rounded-3xl shadow-sm sm:mx-auto sm:max-w-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/biji/biji-hangang.png"
          alt="한강에서 서울 도심을 바라보는 비지 — 비집고 들어갈 집을 그리며"
          width={1200}
          height={655}
          className="block w-full"
          draggable={false}
        />
      </div>

      {/* 캐치프레이즈 — "내 통장으로 / 비집고 / 들어갈 집" (브랜드어는 본문 톤,
          강조 코랄은 CTA 한 곳에 집중해 시선 위계를 살린다) */}
      <p
        className="font-jua mx-auto mt-3 text-[15px] sm:text-[17px]"
        style={{ color: "#8a7d6e" }}
      >
        내 통장으로
      </p>
      <h1
        className="font-jua -mt-0.5 text-[3rem] leading-[1] tracking-tight sm:text-[3.6rem]"
        style={{ color: "#e8662f" }}
      >
        비집고
      </h1>
      <p
        className="font-jua mx-auto mt-0 text-[15px] sm:text-[17px]"
        style={{ color: "#8a7d6e" }}
      >
        들어갈 집
      </p>

      {/* 기능 한 줄 — "무엇을 해주는지"를 3초 안에 (본문 폰트로 위계 대비) */}
      <p
        className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-balance sm:text-[15px]"
        style={{ color: "#6b6157" }}
      >
        수도권 아파트, 내 예산에 맞춰
        <br />
        안정·균형·도전형으로 정리해 드려요
      </p>

      {/* 3-티어 미리보기 — 결과가 세 갈래로 나옴을 시각적으로 예고(안정→도전 따뜻한 그라데이션) */}
      <div className="mx-auto mt-3.5 flex items-center justify-center gap-2 text-[12px] font-bold">
        <span
          className="rounded-full px-3 py-1"
          style={{ background: "#f7ead0", color: "#9a5a1e" }}
        >
          안정형
        </span>
        <span
          className="rounded-full px-3 py-1"
          style={{ background: "#ffd9c7", color: "#c4521f" }}
        >
          균형형
        </span>
        <span
          className="rounded-full px-3 py-1 text-white"
          style={{ background: "#fe7644" }}
        >
          도전형
        </span>
      </div>

      {/* 단일 CTA — 예시카드보다 위에 둬서 첫 화면(스크롤 전)에서 바로 보이게 */}
      <div className="mx-auto mt-5 w-full max-w-sm">
        <Button onClick={onStart} fullWidth>
          30초, 무료로 내 집 찾기 →
        </Button>
        <Link
          href="/plan"
          className="mt-2.5 flex w-full items-center justify-center rounded-2xl border-2 border-coral-300 bg-white px-4 py-3 text-[15px] font-bold transition-colors hover:border-coral-500"
          style={{ color: "#c4521f" }}
        >
          내 집 마련 플랜 · 언제 살 수 있을까? →
        </Link>
        <p className="mt-2 text-[12px]" style={{ color: "#9a8f82" }}>
          가입·로그인 없이 · 민감정보(소득·자산·직장) 저장 안 함
        </p>
        <p className="mt-1.5 text-[12px]" style={{ color: "#9a8f82" }}>
          국토부 공개 실거래가 · 매일 갱신
          {FRESH_DATE ? ` · ${FRESH_DATE} 기준` : " · 무료"}
        </p>
        <p className="mt-1 text-[12px]" style={{ color: "#9a8f82" }}>
          대출·세제 정책 {POLICY_META.effectiveLabel} · {POLICY_VERIFIED_SHORT}{" "}
          점검
        </p>
      </div>

      {/* 예시 결과 미니카드 — 행동(CTA) 아래에서 증거로 받쳐줌(가짜임을 명시) */}
      <div className="mx-auto mt-8 w-full max-w-sm">
        <p className="mb-2 text-[12px] font-semibold" style={{ color: "#9a8f82" }}>
          이런 결과를 받아요
        </p>
        <div
          className="relative rounded-3xl bg-white p-5 text-left"
          style={{
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(0,0,0,0.08)",
          }}
        >
          <span className="absolute right-4 top-4 rounded-full bg-[#f7ead0] px-2.5 py-0.5 text-[10px] font-bold text-[#9a5a1e]">
            예시 화면
          </span>
          <span className="inline-flex items-center rounded-full bg-coral-600 px-2.5 py-1 text-[11px] font-bold text-white">
            균형형
          </span>
          <h3 className="mt-2 text-[18px] font-bold leading-snug" style={{ color: "#3a322c" }}>
            ○○○아파트{" "}
            <span className="text-[13px] font-medium" style={{ color: "#9a8f82" }}>
              전용 84㎡
            </span>
          </h3>
          <p className="mt-1 text-[15px] font-bold" style={{ color: "#e0a23a" }}>
            추정 12억 1,000만
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <MiniBadge>🚇 통근 28분</MiniBadge>
            <MiniBadge>🏫 초품아</MiniBadge>
            <MiniBadge>⭐ 종합 88점</MiniBadge>
          </div>
        </div>
      </div>

      {/* 이번 주 인기 동네·아파트(멜론식) — 데이터 빈약하면 각 컴포넌트가 스스로 숨음 */}
      <NeighborhoodChart />
      <PopularComplexChart />
    </section>
  );
}
