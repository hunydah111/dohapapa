// 오늘의 비집고 — 홈 최상단 0입력 데일리 스트립. "관문"이 아니라 "오늘의 1면".
//
// (a) 패치노트: 어제 대비 새로 공개된 실거래 중 중위가 대비 이탈 상위(너프/버프)
// (b) 오늘의 환산: |이탈| 최대 1건을 월급으로 환산 — 드라이하게, 숫자가 웃기게 둔다
// (c) 판정 훅: 기존 판정 동선(#biji-verdict)으로 연결
// + 문턱 게이지(ThresholdGauge): 옵트인 로컬 프로필 있을 때만 (클라이언트)
//
// 정직성 원칙: 실거래 신고는 계약 후 최대 30일 지연 → 카피는 항상 "공개" 기준.
// "실시간" 금지 · 미래 예측 금지 · 빨간 경보색 금지(너프=딥브라운, 버프=그린).
// 서버 컴포넌트 — 데이터는 빌드/배포 시점 JSON(매일 새벽 5:30 파이프라인이 갱신).

import dailyPatchRaw from "@/data/dailyPatch.json";
import dailyPulseRaw from "@/data/dailyPulse.json";
import { ThresholdGauge, DailyFrontPing } from "./ThresholdGauge";

interface PatchItem {
  kind: "nerf" | "buff";
  sigungu: string;
  dong: string;
  apt: string;
  areaM2: number;
  band: string;
  priceKrw: number;
  medianKrw: number;
  /** 단지 자기 시세 대비 이탈률(소수) — nerf 양수, buff 음수. */
  pct: number;
  dealDate: string;
}

interface DailyPatch {
  generatedAt: string | null;
  scopeDays: number;
  /** 구버전 placeholder 호환 — 새 파이프라인은 mode 를 쓴다. */
  seeded?: boolean;
  /** "bootstrap" = 창간호(최근 N일 계약 공개분), "daily" = 오늘 신규 공개 diff. */
  mode?: "bootstrap" | "daily";
  newDealCount: number;
  scopeDealCount: number;
  nerf: PatchItem[];
  buff: PatchItem[];
  latestDealDate: string | null;
}

interface DailyPulse {
  checkedAt: string | null;
  latestDealDate: string | null;
  recentCount: number | null;
  newSincePrev: number | null;
}

// placeholder(빈 배열)는 never[] 로 추론되므로 명시 캐스팅.
const patch = dailyPatchRaw as unknown as DailyPatch;
const pulse = dailyPulseRaw as unknown as DailyPulse;

/** "2026-06-28" → "6/28". 깨진 값은 그대로 반환. */
function md(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[1])}/${Number(m[2])}` : date;
}

/** 원 → "18.5억" (소수 1자리, .0 은 생략). */
function eok(krw: number): string {
  const v = krw / 100_000_000;
  const s = v.toFixed(1);
  return `${s.endsWith(".0") ? s.slice(0, -2) : s}억`;
}

/** 이탈률(소수) → "8.8" (절대값, 소수 1자리, .0 은 생략). */
function pctAbs(pct: number): string {
  const s = (Math.abs(pct) * 100).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

const NERF_COLOR = "#6B4226"; // 딥브라운 — 경보 아님, 우드톤 강조
const BUFF_COLOR = "#4CB07A"; // 그린

function PatchLine({ item }: { item: PatchItem }) {
  const isNerf = item.kind === "nerf";
  return (
    <li className="text-[13px] leading-relaxed text-[#3a322c]">
      <span
        aria-hidden="true"
        className="font-bold"
        style={{ color: isNerf ? NERF_COLOR : BUFF_COLOR }}
      >
        {isNerf ? "▲" : "▼"}
      </span>{" "}
      <span className="font-semibold">
        {item.sigungu} {item.apt}
      </span>
      <span className="text-[#6b6157]">
        {" "}
        — 단지 시세 대비{" "}
        <span
          className="font-bold"
          style={{ color: isNerf ? NERF_COLOR : BUFF_COLOR }}
        >
          {isNerf ? "+" : "−"}
          {pctAbs(item.pct)}%
        </span>{" "}
        ({eok(item.priceKrw)}, 계약 {md(item.dealDate)})
      </span>
    </li>
  );
}

export function DailyFront() {
  const isEmpty =
    patch.generatedAt === null ||
    (patch.nerf.length === 0 && patch.buff.length === 0);
  const isBootstrap = patch.mode === "bootstrap";

  const nerfTop = patch.nerf.slice(0, 3);
  const buffTop = patch.buff.slice(0, 3);

  // (b) 오늘의 환산 — |pct| 최대 1건. 패치 아이템 있을 때만.
  const featured = isEmpty
    ? null
    : [...patch.nerf, ...patch.buff].reduce<PatchItem | null>(
        (best, it) =>
          best === null || Math.abs(it.pct) > Math.abs(best.pct) ? it : best,
        null,
      );
  const featuredPyeong = featured ? Math.round(featured.areaM2 / 3.3058) : 0;
  // 월급 300 실수령 전액 저축 가정 — 연 3,600만원.
  const featuredYears = featured
    ? Math.round(featured.priceKrw / (3_000_000 * 12))
    : 0;

  return (
    <section className="mx-auto mb-2 flex w-full max-w-md flex-col gap-2.5">
      <DailyFrontPing />

      {/* (a) 패치노트 블록 */}
      <div className="rounded-3xl border border-[#ecd9b3] bg-[#fdf6e7] px-4 py-4 sm:px-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[14px] font-bold text-[#3a2c1d]">
            📋 비집고 패치노트
            {patch.generatedAt && (
              <span className="font-semibold text-[#8a7d6e]">
                {" "}
                · {md(patch.generatedAt)}
                {isBootstrap && " 창간호"}
              </span>
            )}
          </h2>
          <span className="shrink-0 text-[10px]" style={{ color: "#9a8f82" }}>
            매일 새벽 5:30 갱신
          </span>
        </div>

        {isEmpty ? (
          /* 빈 상태 — 패치 없어도 시장이 살아있음은 보여준다(펄스 폴백). */
          <div className="mt-2.5">
            <p className="text-[13px] leading-relaxed text-[#3a322c]">
              {pulse.newSincePrev != null && pulse.latestDealDate ? (
                <>
                  오늘{" "}
                  <span className="font-bold">
                    {pulse.newSincePrev.toLocaleString("ko-KR")}건
                  </span>{" "}
                  신규 공개 · 최신 계약 {md(pulse.latestDealDate)}
                </>
              ) : (
                <>
                  최근 2개월{" "}
                  <span className="font-bold">
                    {(pulse.recentCount ?? 0).toLocaleString("ko-KR")}건
                  </span>{" "}
                  확인
                </>
              )}
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "#8a7d6e" }}>
              {patch.generatedAt === null
                ? "첫 패치노트는 곧 나옵니다"
                : "오늘은 중위가를 흔든 거래가 없어요 · 내일 새벽 5:30 갱신"}
            </p>
          </div>
        ) : (
          <>
            <ul className="mt-2.5 flex flex-col gap-1">
              {nerfTop.map((it) => (
                <PatchLine key={`n-${it.apt}-${it.dealDate}`} item={it} />
              ))}
              {buffTop.map((it) => (
                <PatchLine key={`b-${it.apt}-${it.dealDate}`} item={it} />
              ))}
            </ul>
            <p className="mt-2 text-[12px]" style={{ color: "#8a7d6e" }}>
              {isBootstrap ? (
                <>최근 {patch.scopeDays}일 계약 공개분 {patch.scopeDealCount.toLocaleString("ko-KR")}건 기준</>
              ) : (
                <>오늘 신규 공개 {patch.newDealCount.toLocaleString("ko-KR")}건</>
              )}
              {patch.latestDealDate && (
                <> · 최신 계약 {md(patch.latestDealDate)}</>
              )}
            </p>
          </>
        )}

        <p className="mt-2 text-[10px]" style={{ color: "#9a8f82" }}>
          국토부 실거래 공개분 기준 · 신고는 계약 후 최대 30일
        </p>
      </div>

      {/* (b) 오늘의 환산 — 드라이하게. 숫자가 웃기게 둔다. */}
      {featured && (
        <div className="rounded-2xl border border-[#ecd9b3] bg-white/70 px-4 py-3">
          <p className="text-[13px] leading-relaxed text-[#3a322c]">
            <span className="font-semibold">
              {featured.apt} {featuredPyeong}평 {eok(featured.priceKrw)}
            </span>
            <span className="text-[#6b6157]">
              {" "}
              = 월급 300 실수령 기준, 한 푼 안 쓰고{" "}
            </span>
            <span className="font-bold text-[#3a2c1d]">{featuredYears}년</span>
          </p>
          <p className="mt-0.5 text-[10px]" style={{ color: "#9a8f82" }}>
            (가정: 월 300 저축 전액)
          </p>
        </div>
      )}

      {/* (c) 판정 훅 — 기존 판정 동선으로 */}
      <a
        href="#biji-verdict"
        className="flex items-center justify-between rounded-2xl border border-coral-200 bg-coral-50 px-4 py-3 transition-colors hover:bg-coral-100 focus:outline-none focus:ring-2 focus:ring-coral-400"
      >
        <span className="text-[13px] font-bold text-coral-800">
          그래서 이 동네들, 내 통장으론?
        </span>
        <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-coral-700 shadow-sm">
          30초 판정 →
        </span>
      </a>

      {/* 문턱 게이지 — 옵트인 로컬 프로필 있을 때만 (없으면 아무것도 안 그림) */}
      <ThresholdGauge />
    </section>
  );
}
