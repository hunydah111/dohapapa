import { Button } from "@/components/ui/Button";
import dataMeta from "@/data/dataMeta.json";

// 최근 실거래 반영일 — "2026-05-20" → "2026.5.20". 매일 크론이 dataMeta.json 을 갱신.
const FRESH_DATE: string | null = (() => {
  const d = dataMeta.latestDealDate;
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${y}.${Number(m)}.${Number(day)}`;
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
            "radial-gradient(60% 70% at 50% 12%, rgba(224,162,58,0.20) 0%, rgba(79,157,84,0.12) 44%, rgba(245,236,217,0) 75%)",
        }}
      />

      {/* 비집고 로고 비지 — 아파트 사이를 비집고 들어가는 비버 + 등장 모션 */}
      <div className="biji-pop-in flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/biji/biji-hero.png?v=1"
          alt="비집고 비지 — 아파트 사이를 비집고"
          width={132}
          height={132}
          className="h-32 w-32 rounded-3xl drop-shadow-md"
          draggable={false}
        />
      </div>

      {/* 메인 캐치프레이즈 — 슬로건 */}
      <h1
        className="font-jua mt-2 text-[2.1rem] leading-[1.2] tracking-tight sm:text-[2.9rem]"
        style={{ color: "#3a2c1d" }}
      >
        묻고 따지고 <span className="text-coral-600">비집고</span>
      </h1>

      {/* 서브 캐치프레이즈 — 무엇을 하는 서비스인지 */}
      <p
        className="font-jua mx-auto mt-2 text-[17px] sm:text-[19px]"
        style={{ color: "#6b6157" }}
      >
        내 통장으로 살 집 찾기
      </p>

      {/* 예시 결과 미니카드 — 무엇을 받는지 미리 보여주기(가짜임을 명시) */}
      <div className="mx-auto mt-6 w-full max-w-sm">
        <p className="mb-2 text-[12px] font-semibold" style={{ color: "#9a8f82" }}>
          이런 결과를 받아요
        </p>
        <div
          className="relative rounded-3xl bg-white p-5 text-left"
          style={{
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(0,0,0,0.12)",
          }}
        >
          <span className="absolute right-4 top-4 rounded-full bg-[#f3ece4] px-2 py-0.5 text-[10px] font-bold text-[#9a8f82]">
            예시
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

      {/* 단일 CTA */}
      <div className="mx-auto mt-6 w-full max-w-sm">
        <Button onClick={onStart} fullWidth>
          내 집 찾기 시작 →
        </Button>
        <p className="mt-3 text-[12px]" style={{ color: "#9a8f82" }}>
          국토교통부 공개 실거래가 기반 · 매일 자동 갱신 · 무료
        </p>
        {FRESH_DATE && (
          <p className="mt-1 text-[11px]" style={{ color: "#9a8f82" }}>
            📅 최근 실거래 {FRESH_DATE}까지 반영
          </p>
        )}
      </div>
    </section>
  );
}
