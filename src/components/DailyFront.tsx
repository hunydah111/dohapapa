// 비집고 1면 — 홈 최상단 0입력 데일리 스트립, 신문 지면 조판 (2026-07-04 전면 재작성).
//
// 구조(위→아래): 정보띠 → 제호(이코노미스트식 코랄 플레이트) → 오늘의 헤드라인(뉴스가치 사다리)
//   → 오늘의 온도 → [주요 거래] → [강세 거래] → [약세 동네] → [내 문턱 · 구독자란] → CTA → 콜로폰.
// 하락(버프) 실명 리스트는 2026-07-06 사장 지시로 폐지 — 급락 단지 실명 노출 = 주민 비하.
//   하락은 [약세 동네](시군구 집계)로만 다루고, buff 데이터는 분석용으로만 남긴다.
//
// 조판 토큰(bijigo-front-mockup 시안 A): 종이 #fbfaf6 · 먹 #191713 · 보조 #5d574c
//   · 괘선 #c9c3b4 · 코랄 #e8571f(제호 플레이트·CTA·판정 링크만) · 그린 #2e7d52. 명조는 셀프호스팅.
//
// 정직성 원칙: 실거래 신고는 계약 후 최대 30일 지연 → 카피는 항상 "공개" 기준.
// "실시간" 금지 · 미래 예측 금지 · 빨간 경보색 금지(너프=먹, 버프=그린) · 캐릭터/이모지 0.
// 서버 컴포넌트 — 데이터는 빌드/배포 시점 JSON(매일 새벽 5:30 파이프라인이 갱신).
// 하위호환: 라이브 dailyPatch.json은 다음 크론 전까지 major/temp 필드가 없다(구 스키마)
//   → 둘 다 optional, 없으면 해당 코너/줄을 조용히 접는다.

import dailyPatchRaw from "@/data/dailyPatch.json";
import dailyPulseRaw from "@/data/dailyPulse.json";
import {
  pickHeadline,
  type MajorItem,
  type PatchTemp,
  type RegionPulse,
  type CancellationItem,
  type BusiestRegion,
  type HeadlinesResult,
} from "@/lib/patchNote";
import { ThresholdGauge, DailyFrontPing } from "./ThresholdGauge";
import { DealMiniMap } from "./DealMiniMap";
// 명조·조판 토큰 — 공유 모듈(단일 소스, 2026-07-06 홈 하부 톤 통일). 중복 선언 금지.
import { serif, PAPER, INK, INK_SOFT, RULE, CORAL, GREEN } from "@/lib/paperTone";

interface PatchItem {
  kind: "nerf" | "buff";
  sigungu: string;
  dong: string;
  apt: string;
  areaM2: number;
  band: string;
  priceKrw: number;
  medianKrw: number;
  /** 단지 자기 중위가 대비 이탈률(소수) — 내부 선별 필터 값. 화면 노출 금지("시세" 단정 위험). */
  pct: number;
  dealDate: string;
  /** 최근 1년 실거래 최고가(원) — 구 스키마·구 스냅샷엔 없음. */
  maxKrw?: number | null;
  /** 같은 단지×밴드 직전 실거래가(원, 60일 내) — 화면 노출용 팩트. 구 스키마엔 없음. */
  prevKrw?: number | null;
  /** 직전 실거래 계약일 YYYY-MM-DD. */
  prevDate?: string | null;
  /** (price − prevKrw) / prevKrw — 화면 노출용 등락(팩트 기준). */
  pctVsPrev?: number | null;
  /** 폴링창 내 자기 제외 최고가 — 헤드라인 rung 판정용. */
  windowMaxKrw?: number | null;
  /** 단지 좌표 — 행 미니맵·카카오맵 링크용. 스냅샷 미등재면 null. */
  lat?: number | null;
  lng?: number | null;
  /** 층 — 행 메타 "12층" 태그. 구 스키마엔 없음. */
  floor?: number | null;
  /** 최근접 지하철역 거리(m) — 행 메타 "역 350m" 태그. 구 스키마엔 없음. */
  nearestSubwayM?: number | null;
}

interface DailyPatch {
  generatedAt: string | null;
  scopeDays: number;
  /** 구버전 placeholder 호환 — 새 파이프라인은 mode 를 쓴다. */
  seeded?: boolean;
  /** "bootstrap" = 창간호, "daily" = 오늘 신규 공개 diff,
   *  "merged" = 주말 저볼륨 합산(최근 2~3일 공개분 — 라벨 병기 의무). */
  mode?: "bootstrap" | "daily" | "merged";
  /** merged 합산 구간 — "주말 합산 · {M/D}~{M/D} 공개분" 라벨용. merged 아닐 땐 null. */
  mergedFromDate?: string | null;
  mergedToDate?: string | null;
  newDealCount: number;
  scopeDealCount: number;
  nerf: PatchItem[];
  buff: PatchItem[];
  /** 오늘 공개된 15억 이상 중개거래 전부 — 구 스키마엔 없음(optional 필수). */
  major?: MajorItem[];
  /** 오늘의 온도 — 구 스키마엔 없음. 표본 부족이면 null. */
  temp?: PatchTemp | null;
  /** [약세 동네] — 구 스키마엔 없음(optional 필수). 없거나 비면 코너 자체 생략. */
  weakRegions?: RegionPulse[];
  /** 대칭 강세 집계 — 데이터만, UI 비게재([강세 거래] 실명이 담당). */
  strongRegions?: RegionPulse[];
  /** [오늘의 해제] — 구 스키마엔 없음. 0건이면 코너 생략. */
  cancellations?: CancellationItem[];
  /** 오늘 최다 공개 동네 — 구 스키마엔 없음. 비면 줄 생략. */
  busiestRegions?: BusiestRegion[];
  /** 헤드라인 묶음(톱 1 + 서브 ≤3) — 구 스키마엔 없음 → 기존 단일 헤드라인 로직 폴백. */
  headlines?: HeadlinesResult;
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

// ── 포맷터 ────────────────────────────────────────────────────────────────────
/** "2026-06-28" → "6/28". 깨진 값은 그대로 반환. */
function md(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[1])}/${Number(m[2])}` : date;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** "2026-07-04" → "2026년 7월 4일 금요일". 깨진 값은 그대로. */
function koDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(`${date}T00:00:00Z`);
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일 ${WEEKDAYS[d.getUTCDay()]}요일`;
}

/** 원 → "18.5억" (소수 1자리, .0 은 생략). */
function eok(krw: number): string {
  const v = krw / 100_000_000;
  const s = v.toFixed(1);
  return `${s.endsWith(".0") ? s.slice(0, -2) : s}억`;
}

/** 전용면적 → "84.9" (소수 1자리, .0 은 생략 — 원본 84.898 같은 꼬리 방지). */
function sqm(area: number): string {
  const s = area.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** 이탈률(소수) → "8.8" (절대값, 소수 1자리, .0 은 생략). */
function pctAbs(pct: number): string {
  const s = (Math.abs(pct) * 100).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** 역거리 태그 상한(m) — 1km 초과면 "역세권" 정보가치가 없어 생략. */
const SUBWAY_TAG_MAX_M = 1000;

/** 층·역거리 메타 태그 — "12층 · 역 350m". 없는 값은 생략, 둘 다 없으면 null. */
function floorSubwayTag(
  floor?: number | null,
  nearestSubwayM?: number | null,
): string | null {
  const parts: string[] = [];
  if (floor != null) parts.push(`${floor}층`);
  if (nearestSubwayM != null && nearestSubwayM <= SUBWAY_TAG_MAX_M)
    parts.push(`역 ${Math.round(nearestSubwayM)}m`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// ── 조판 부품 ─────────────────────────────────────────────────────────────────
/** 동네면 링크 — 지면 동네명 → /r/[시군구]. 먹색 유지 + 점선 밑줄(절제된 링크 표시)로
 *  지면 조판 톤을 깨지 않는다. 공백 포함 시군구("수원시 팔달구")는 encodeURIComponent. */
function RegionLink({
  sigungu,
  children,
  className,
  style,
  ...rest
}: {
  sigungu: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
} & Record<`data-${string}`, string>) {
  return (
    <a
      href={`/r/${encodeURIComponent(sigungu)}`}
      title={`${sigungu} 동네면`}
      className={`underline decoration-dotted underline-offset-2 ${className ?? ""}`}
      style={{ color: INK, ...style }}
      {...rest}
    >
      {children}
    </a>
  );
}

/** 코너 라벨 — 먹색 바탕 흰 글씨 사각 칩. */
function CornerLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mb-2.5 inline-block px-2 py-[3px] text-[11px] font-bold tracking-[0.18em]"
      style={{ background: INK, color: PAPER }}
    >
      {children}
    </span>
  );
}

function CornerNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[10.5px] leading-[1.55]" style={{ color: INK_SOFT }}>
      {children}
    </p>
  );
}

/** 행 펼침 힌트 — details marker 대용 ▸ (group-open 시 90° 회전). */
function RowHint() {
  return (
    <span
      aria-hidden="true"
      className="ml-0.5 inline-block text-[9px] transition-transform duration-150 group-open:rotate-90"
      style={{ color: INK_SOFT }}
    >
      ▸
    </span>
  );
}

/** 행 펼침 내용 — 단지 미니맵(좌표·카카오 JS 키 있을 때만) + 카카오맵 링크(키 불필요). */
function DealLocation({
  apt,
  sigungu,
  lat,
  lng,
}: {
  apt: string;
  sigungu: string;
  lat?: number | null;
  lng?: number | null;
}) {
  const hasCoords = lat != null && lng != null;
  const kakaoHref = hasCoords
    ? `https://map.kakao.com/link/map/${encodeURIComponent(apt)},${lat},${lng}`
    : `https://map.kakao.com/link/search/${encodeURIComponent(`${sigungu} ${apt}`)}`;
  return (
    <div className="mb-1.5 mt-1 flex flex-col gap-1.5 border p-2" style={{ borderColor: RULE }}>
      {hasCoords && <DealMiniMap label={apt} lat={lat!} lng={lng!} />}
      <a
        href={kakaoHref}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start text-[11.5px] font-bold underline underline-offset-2"
        style={{ color: INK }}
      >
        카카오맵에서 보기 →
      </a>
    </div>
  );
}

/** 행을 네이티브 <details>로 — 탭하면 위치(미니맵+카카오맵 링크) 펼침. JS 없이 동작. */
function DealDetails({
  item,
  children,
}: {
  item: { apt: string; sigungu: string; lat?: number | null; lng?: number | null };
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      <summary className="block cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {children}
      </summary>
      <DealLocation apt={item.apt} sigungu={item.sigungu} lat={item.lat} lng={item.lng} />
    </details>
  );
}

/** 주요 거래 행 — 점선 괘선 · 숫자 tabular-nums · 가격 우측 정렬.
 *  서브라인: 기준점(기간 내 최고 거래가) 병기 — 스냅샷 1년 최고 우선, 없으면 폴링창 2개월. */
function MajorRow({ item, divider }: { item: MajorItem; divider: boolean }) {
  const refMax = item.windowMaxKrw ?? null;
  const tag = floorSubwayTag(item.floor, item.nearestSubwayM);
  return (
    <div
      className={`py-[5.5px] tabular-nums ${divider ? "border-t border-dotted" : ""}`}
      style={divider ? { borderColor: RULE } : undefined}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: INK }}>
          <RegionLink sigungu={item.sigungu}>{item.dong}</RegionLink> {item.apt}{" "}
          <span className="text-[11px] font-normal" style={{ color: INK_SOFT }}>
            {sqm(item.areaM2)}㎡{tag ? ` · ${tag}` : ""}
          </span>
          <RowHint />
        </span>
        <span className="shrink-0 text-right text-[13px] font-bold" style={{ color: INK }}>
          {eok(item.priceKrw)}
        </span>
        <span className="w-[62px] shrink-0 text-right text-[11px]" style={{ color: INK_SOFT }}>
          계약 {md(item.dealDate)}
        </span>
      </div>
      {/* 기준점 서브라인 — 비교 대상 없으면(신축 첫거래 등) 생략. */}
      {refMax !== null && item.refMaxPeriod && (
        <div className="mt-[1px] text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
          {item.priceKrw >= refMax ? (
            <b style={{ color: INK }}>— {item.refMaxPeriod} 내 최고가</b>
          ) : (
            <>
              최근 {item.refMaxPeriod} 최고 {eok(refMax)}
              {item.windowMaxDate ? ` (${md(item.windowMaxDate)})` : ""}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** [강세 거래] 행 — ▲ 먹 (빨간 경보색 금지). 비교는 전부 실거래 팩트(직전 거래, 날짜 병기).
 *  하락 실명 행은 폐지(주민 비하 금지) — 하락은 [약세 동네] 시군구 집계로만 다룬다. */
function StrongRow({ item, divider }: { item: PatchItem; divider: boolean }) {
  const tag = floorSubwayTag(item.floor, item.nearestSubwayM);
  return (
    <div
      className={`py-[5.5px] tabular-nums ${divider ? "border-t border-dotted" : ""}`}
      style={divider ? { borderColor: RULE } : undefined}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: INK }}>
          <span aria-hidden="true" className="mr-1 font-extrabold" style={{ color: INK }}>
            ▲
          </span>
          <RegionLink sigungu={item.sigungu}>{item.sigungu}</RegionLink> {item.apt}{" "}
          <span className="text-[11px] font-normal" style={{ color: INK_SOFT }}>
            {sqm(item.areaM2)}㎡{tag ? ` · ${tag}` : ""}
          </span>
          <RowHint />
        </span>
        <span className="shrink-0 text-right text-[13px] font-extrabold" style={{ color: INK }}>
          +{pctAbs(item.pctVsPrev!)}%
        </span>
      </div>
      {/* 팩트 라인 — 직전 거래 날짜 병기 의무(사장 지시). */}
      <div className="mt-[1px] pl-[18px] text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
        직전 {md(item.prevDate!)} {eok(item.prevKrw!)} → {eok(item.priceKrw)} · 계약{" "}
        {md(item.dealDate)}
      </div>
    </div>
  );
}

/** [오늘의 해제] 행 — 국토부 공개 행정 사실만 인쇄. 해제 사유는 데이터에 없으므로
 *  어떤 해석·단정도 붙이지 않는다("조작" 류 단어 금지). 경보색 금지 — 먹 톤. */
function CancellationRow({ item, divider }: { item: CancellationItem; divider: boolean }) {
  const tag = floorSubwayTag(item.floor, item.nearestSubwayM);
  return (
    <div
      className={`py-[5.5px] tabular-nums ${divider ? "border-t border-dotted" : ""}`}
      style={divider ? { borderColor: RULE } : undefined}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: INK }}>
          <RegionLink sigungu={item.sigungu}>{item.dong}</RegionLink> {item.apt}{" "}
          <span className="text-[11px] font-normal" style={{ color: INK_SOFT }}>
            {sqm(item.areaM2)}㎡{tag ? ` · ${tag}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right text-[13px] font-bold" style={{ color: INK }}>
          {eok(item.priceKrw)}
        </span>
        <span className="w-[62px] shrink-0 text-right text-[11px]" style={{ color: INK_SOFT }}>
          계약 {md(item.dealDate)}
        </span>
      </div>
      {/* 최고가 공개 이력 — wasTopInWindow(다른 유효 거래 전부보다 높았음)일 때만 인쇄. */}
      {item.wasTopInWindow && (
        <div className="mt-[1px] text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
          — 해제 전까지 이 단지 최고가로 공개돼 있었음
        </div>
      )}
    </div>
  );
}

/** [약세 동네] 행 — 시군구 집계(실명 단지 없음), 그린 톤. 기준은 직전 실거래(팩트). */
function WeakRegionRow({ item, divider }: { item: RegionPulse; divider: boolean }) {
  return (
    <div
      className={`flex items-baseline gap-2 py-[5.5px] tabular-nums ${divider ? "border-t border-dotted" : ""}`}
      style={divider ? { borderColor: RULE } : undefined}
    >
      <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: INK }}>
        <span aria-hidden="true" className="mr-1 font-extrabold" style={{ color: GREEN }}>
          ▼
        </span>
        <RegionLink sigungu={item.sigungu}>{item.sigungu}</RegionLink>
      </span>
      <span className="shrink-0 text-right text-[13px] font-extrabold" style={{ color: GREEN }}>
        직전 거래 대비 평균 −{pctAbs(item.avgPct)}%
      </span>
      <span className="w-[46px] shrink-0 text-right text-[11px]" style={{ color: INK_SOFT }}>
        {item.count}건
      </span>
    </div>
  );
}

/** [주요 거래] 상위 노출 건수 — 초과분은 <details> 네이티브 펼치기(JS 없이). */
const MAJOR_VISIBLE = 10;
/** 환산 가정 — 월급 300 실수령 전액 저축(연 3,600만원). */
const SAVING_KRW_PER_YEAR = 3_000_000 * 12;

export function DailyFront() {
  // 발행 전(generatedAt null) = 창간 전 폴백 지면.
  const isPrelaunch = patch.generatedAt === null;
  const isBootstrap = patch.mode === "bootstrap";
  // 주말 저볼륨 합산 — 최근 2~3일 공개분을 합쳐 판독. 라벨 병기 의무(정직성).
  const isMerged =
    patch.mode === "merged" && !!patch.mergedFromDate && !!patch.mergedToDate;
  /** merged 각주 접미 — "각 각주"에 합산 구간을 병기(사장 지시). */
  const mergedNote = isMerged
    ? ` · 주말 합산 ${md(patch.mergedFromDate!)}~${md(patch.mergedToDate!)} 공개분`
    : "";
  // "오늘 공개 N건" — 창간호는 스코프 공개분, 일간/합산은 신규 diff.
  const openCount = isBootstrap ? patch.scopeDealCount : patch.newDealCount;

  // 하위호환 — 구 스키마(major/temp 없음)에서도 절대 깨지지 않는다.
  const major = patch.major; // undefined = 구 스키마, [] = 오늘 없음
  const temp = patch.temp ?? null;

  // 헤드라인 — 새 스키마는 빌드타임 headlines(톱+서브) 사용, 구 스키마는 기존 단일 로직 폴백.
  const headline = isPrelaunch
    ? null
    : patch.headlines?.top ??
      pickHeadline({
        major: major ?? [],
        nerf: patch.nerf,
        newDealCount: openCount,
        todayISO: patch.generatedAt!,
      });
  const subHeadlines = patch.headlines?.subs ?? []; // 구 스키마 → [] = 섹션 생략

  const majorVisible = major?.slice(0, MAJOR_VISIBLE) ?? [];
  const majorRest = major?.slice(MAJOR_VISIBLE) ?? [];
  // 환산 서브라인 — 1위(최고가) 거래 기준.
  const convYears = major && major[0] ? Math.round(major[0].priceKrw / SAVING_KRW_PER_YEAR) : 0;

  // [강세 거래] = 상승(너프) 실명만, 그것도 직전 거래 팩트(prevKrw·60일 내)가 있는 것만
  // — 표시할 팩트가 없으면 안 싣는다. 하락(버프) 실명 리스트는 게재 폐지(주민 비하 금지).
  const strongs = patch.nerf.filter(
    (i) => i.prevKrw != null && i.prevDate != null && (i.pctVsPrev ?? 0) > 0,
  );
  // 구 스키마(직전 거래 필드 없는 nerf만 있음) — 새 기준 데이터가 올 때까지 예고 문구.
  const strongLegacy = strongs.length === 0 && patch.nerf.length > 0;
  const weakRegions = patch.weakRegions ?? []; // 구 스키마(undefined)·표본 없음([]) → 코너 생략
  const cancellations = patch.cancellations ?? []; // 구 스키마·0건 → 코너 생략
  const busiestRegions = patch.busiestRegions ?? []; // 구 스키마·비면 줄 생략

  // 온도 게이지 분할 — 위(먹) : 중립(괘선) : 아래(그린), matched 대비 비율.
  const tempPct = temp
    ? {
        above: Math.round((temp.above / temp.matched) * 100),
        below: Math.round((temp.below / temp.matched) * 100),
      }
    : null;

  return (
    <section className="mx-auto mb-4 w-full max-w-md">
      <DailyFrontPing />

      <div
        className="px-[18px] pb-[22px] pt-[18px]"
        style={{
          background: PAPER,
          color: INK,
          boxShadow: "0 2px 6px rgba(40,35,25,.14), 0 10px 32px rgba(40,35,25,.16)",
        }}
      >
        {/* ── 정보띠 ── */}
        <div
          className="flex justify-between pb-1.5 text-[10.5px] tracking-[0.05em] tabular-nums"
          style={{ color: INK_SOFT }}
        >
          <span>
            {isPrelaunch ? "창간 준비호" : koDate(patch.generatedAt!)}
            {/* 주말 합산 라벨 — 헤더 날짜 옆 병기(정직성 의무). */}
            {isMerged && (
              <>
                {" "}
                · 주말 합산 {md(patch.mergedFromDate!)}~{md(patch.mergedToDate!)} 공개분
              </>
            )}
          </span>
          <span>오늘의 판 · 매일 새벽 5:30 발행</span>
        </div>

        {/* ── 제호 — 이코노미스트식 코랄 플레이트(2026-07-06 사장 지시, 判 도장 폐지).
            각진 사각(라운드·회전 금지), 텍스트에 딱 맞는 패딩, 흰 명조 워드마크.
            대비: #e8571f 위 #fbfaf6 ≈ 3.5:1 — 34px 굵은 글씨(large text) AA 통과. ── */}
        <header
          className="flex items-center justify-between px-0.5 pb-2.5 pt-3"
          style={{ borderTop: `2.5px solid ${INK}`, borderBottom: `1px solid ${INK}` }}
        >
          <h2
            className={`${serif.className} m-0 inline-block px-3 py-1.5 text-[34px] font-extrabold leading-none tracking-[0.16em]`}
            style={{ background: CORAL, color: PAPER }}
          >
            비집고
          </h2>
          <p className="m-0 text-right text-[10.5px] leading-[1.5]" style={{ color: INK_SOFT }}>
            통장 까면, 동네 나온다
            <br />
            예산으로 찾는 수도권 아파트
          </p>
        </header>

        {/* ── 오늘의 헤드라인 ── */}
        <div className="px-0.5 pb-3 pt-3.5" style={{ borderBottom: `1px solid ${RULE}` }}>
          {isPrelaunch ? (
            <>
              <h3
                className={`${serif.className} m-0 text-[21px] font-extrabold leading-[1.38] break-keep`}
              >
                첫 지면은 곧 발행됩니다
              </h3>
              <p className="mb-0 mt-1.5 text-[12.5px] leading-[1.6]" style={{ color: INK_SOFT }}>
                {pulse.newSincePrev != null && pulse.latestDealDate ? (
                  <>
                    오늘{" "}
                    <b className="tabular-nums" style={{ color: INK }}>
                      {pulse.newSincePrev.toLocaleString("ko-KR")}건
                    </b>{" "}
                    신규 공개 · 최신 계약 {md(pulse.latestDealDate)}
                  </>
                ) : (
                  <>
                    최근 2개월{" "}
                    <b className="tabular-nums" style={{ color: INK }}>
                      {(pulse.recentCount ?? 0).toLocaleString("ko-KR")}건
                    </b>{" "}
                    확인
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <h3
                className={`${serif.className} m-0 text-[21px] font-extrabold leading-[1.38] break-keep`}
              >
                {headline!.text}
              </h3>

              {/* 서브 헤드라인 — 세그먼트 칩([서울]·[경기·인천]·[9억 이하], CornerLabel보다
                  작게) + 명조 볼드 소형. 서브 0개면 섹션 자체 생략(구 스키마 포함). */}
              {subHeadlines.length > 0 && (
                <div className="mt-2 flex flex-col gap-[5px]">
                  {subHeadlines.map((s) => (
                    <div key={s.label} className="flex items-baseline gap-1.5">
                      <span
                        className="shrink-0 px-1.5 py-[2px] text-[9.5px] font-bold tracking-[0.12em]"
                        style={{ background: INK, color: PAPER }}
                      >
                        {s.label}
                      </span>
                      <span
                        className={`${serif.className} min-w-0 text-[13.5px] font-bold leading-[1.45] break-keep`}
                        style={{ color: INK }}
                      >
                        {s.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="mb-0 mt-1.5 text-[12.5px] leading-[1.6]" style={{ color: INK_SOFT }}>
                {isBootstrap ? (
                  <>
                    최근 {patch.scopeDays}일 계약 공개분{" "}
                    <b className="tabular-nums" style={{ color: INK }}>
                      {patch.scopeDealCount.toLocaleString("ko-KR")}건
                    </b>{" "}
                    판독 결과
                  </>
                ) : isMerged ? (
                  <>
                    주말 합산 {md(patch.mergedFromDate!)}~{md(patch.mergedToDate!)} 공개{" "}
                    <b className="tabular-nums" style={{ color: INK }}>
                      {patch.newDealCount.toLocaleString("ko-KR")}건
                    </b>{" "}
                    판독 결과
                  </>
                ) : (
                  <>
                    오늘 신규 공개{" "}
                    <b className="tabular-nums" style={{ color: INK }}>
                      {patch.newDealCount.toLocaleString("ko-KR")}건
                    </b>{" "}
                    판독 결과
                  </>
                )}
                {patch.latestDealDate && <>. 최신 계약 {md(patch.latestDealDate)}.</>}
                {headline!.kind === "first-trade" && (
                  <> 거래 이력이 없는 신축의 첫 공개 — 기준가가 찍히는 순간이다.</>
                )}
              </p>

              {/* 오늘의 온도 — 직전 실거래 대비(팩트 기준). 표본 부족·구 스키마면 생략. */}
              {temp && tempPct && (
                <div className="mt-2.5">
                  <p className="m-0 text-[12px] leading-[1.6] tabular-nums" style={{ color: INK_SOFT }}>
                    오늘의 온도 — 직전 거래보다 높게{" "}
                    <b style={{ color: INK }}>{tempPct.above}%</b> : 낮게{" "}
                    <b style={{ color: GREEN }}>{tempPct.below}%</b>{" "}
                    <span className="text-[10.5px]">
                      (직전 실거래가 있는 거래 {temp.matched.toLocaleString("ko-KR")}건 기준
                      {mergedNote})
                    </span>
                  </p>
                  <div
                    className="mt-1 flex h-[3px] w-full overflow-hidden"
                    role="img"
                    aria-label={`오늘 공개 거래 중 직전 실거래보다 높게 ${tempPct.above}%, 낮게 ${tempPct.below}%`}
                  >
                    <span style={{ width: `${tempPct.above}%`, background: INK }} />
                    <span
                      style={{
                        width: `${Math.max(0, 100 - tempPct.above - tempPct.below)}%`,
                        background: RULE,
                      }}
                    />
                    <span style={{ width: `${tempPct.below}%`, background: GREEN }} />
                  </div>
                </div>
              )}

              {/* 오늘 최다 공개 동네 — fresh 유효 거래 시군구 상위 3(3건 이상만).
                  동네명은 동네면(/r/[시군구]) 링크 — data-region 은 기존 셀렉터 호환 유지.
                  구 스키마·비면 생략. */}
              {busiestRegions.length > 0 && (
                <p
                  className="mb-0 mt-2 text-[12px] leading-[1.6] tabular-nums"
                  style={{ color: INK_SOFT }}
                >
                  {isMerged ? "이번 합산에서" : "오늘"} 가장 많이 공개된 동네 —{" "}
                  {busiestRegions.map((r, i) => (
                    <span key={r.sigungu}>
                      {i > 0 && " · "}
                      <RegionLink sigungu={r.sigungu} data-region={r.sigungu} className="font-bold">
                        {r.sigungu}
                      </RegionLink>{" "}
                      {r.count.toLocaleString("ko-KR")}건
                    </span>
                  ))}
                </p>
              )}
            </>
          )}
        </div>

        {!isPrelaunch && (
          <>
            {/* ── [주요 거래] — 오늘 공개된 수도권 15억 이상 전부 ── */}
            <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
              <CornerLabel>주요 거래</CornerLabel>
              {major === undefined ? (
                // 구 스키마(다음 크론 전) — 한 줄 예고로 처리.
                <CornerNote>「주요 거래」 코너는 다음 호부터 게재됩니다.</CornerNote>
              ) : major.length === 0 ? (
                <CornerNote>오늘 공개분엔 15억 이상 중개거래가 없었습니다.</CornerNote>
              ) : (
                <>
                  <div>
                    {majorVisible.map((item, i) => (
                      <div key={`${item.apt}-${item.dealDate}-${item.priceKrw}-${i}`}>
                        <DealDetails item={item}>
                          <MajorRow item={item} divider={i > 0} />
                        </DealDetails>
                        {i === 0 && (
                          <div
                            className="mb-1 mt-0.5 border-l-2 pl-2 text-[11.5px] leading-[1.55]"
                            style={{ borderColor: RULE, color: INK_SOFT }}
                            title="가정: 월급 300 실수령, 한 푼 안 쓰고 전액 저축"
                          >
                            월급 300 기준{" "}
                            <b className="tabular-nums" style={{ color: INK }}>
                              {convYears}년
                            </b>{" "}
                            — 내 조건으론?{" "}
                            <a
                              href="#biji-verdict"
                              className="font-bold underline underline-offset-2"
                              style={{ color: CORAL }}
                            >
                              30초 판정 →
                            </a>{" "}
                            <span className="text-[9.5px]">(월 300 전액 저축 가정)</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {majorRest.length > 0 && (
                    <details className="mt-1">
                      <summary
                        className="cursor-pointer list-none py-1 text-[11.5px] font-bold"
                        style={{ color: INK_SOFT }}
                      >
                        전체 {major.length}건 펼치기 ▾
                      </summary>
                      <div className="border-t border-dotted" style={{ borderColor: RULE }}>
                        {majorRest.map((item, i) => (
                          <DealDetails
                            key={`${item.apt}-${item.dealDate}-${item.priceKrw}-r${i}`}
                            item={item}
                          >
                            <MajorRow item={item} divider={i > 0} />
                          </DealDetails>
                        ))}
                      </div>
                    </details>
                  )}
                  <CornerNote>
                    {isMerged ? "합산 기간에" : "오늘"} 공개된 수도권 15억 이상 중개거래 전부 ·
                    직거래·해제 제외{mergedNote}.
                  </CornerNote>
                </>
              )}
            </section>

            {/* ── [강세 거래] — 직전 실거래(팩트)보다 높게 팔린 중개거래 실명 ── */}
            <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
              <CornerLabel>강세 거래</CornerLabel>
              {strongLegacy ? (
                <CornerNote>「강세 거래」 코너는 다음 호부터 직전 실거래 대비 기준으로 게재됩니다.</CornerNote>
              ) : strongs.length === 0 ? (
                <CornerNote>오늘 공개분엔 직전 거래보다 눈에 띄게 높게 팔린 중개거래가 없었습니다.</CornerNote>
              ) : (
                <>
                  <div>
                    {strongs.map((item, i) => (
                      <DealDetails key={`${item.kind}-${item.apt}-${item.dealDate}`} item={item}>
                        <StrongRow item={item} divider={i > 0} />
                      </DealDetails>
                    ))}
                  </div>
                  <CornerNote>
                    비교는 <b style={{ color: INK }}>같은 단지·평형의 최근 60일 내 직전 실거래</b>{" "}
                    기준 · 단지 최근 거래 기록과 대조해 선별 · {isMerged ? "합산" : "오늘"} 공개{" "}
                    {openCount.toLocaleString("ko-KR")}건 중{" "}
                    <b className="tabular-nums" style={{ color: INK }}>
                      {strongs.length}건
                    </b>{" "}
                    · 직거래·해제 제외{mergedNote}.
                  </CornerNote>
                </>
              )}
            </section>

            {/* ── [약세 동네] — 시군구 집계만(특정 단지 실명 급락 게재 금지 — 2026-07-06 사장 지시).
                구 스키마(weakRegions 없음)·표본 없음이면 코너 자체를 조용히 생략. ── */}
            {weakRegions.length > 0 && (
              <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
                <CornerLabel>약세 동네</CornerLabel>
                <div>
                  {weakRegions.map((item, i) => (
                    <WeakRegionRow key={item.sigungu} item={item} divider={i > 0} />
                  ))}
                </div>
                <CornerNote>
                  {isMerged ? "합산 기간에" : "오늘"} 공개된 중개거래의 직전 실거래(같은
                  단지·평형, 최근 60일 내) 대비 평균 · 5건 이상 동네만{mergedNote}.
                </CornerNote>
              </section>
            )}

            {/* ── [오늘의 해제] — 신고가-해제 감시. 국토부 공개 행정 사실만 인쇄, 사유
                단정 금지("조작" 류 단어 금지 — 편집 헌장). 0건·구 스키마면 코너 생략. ── */}
            {cancellations.length > 0 && (
              <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
                <CornerLabel>오늘의 해제</CornerLabel>
                <p className="m-0 text-[12.5px] leading-[1.6]" style={{ color: INK_SOFT }}>
                  {isMerged
                    ? `주말 합산 ${md(patch.mergedFromDate!)}~${md(patch.mergedToDate!)} 해제 신고`
                    : "오늘 해제 신고"}{" "}
                  <b className="tabular-nums" style={{ color: INK }}>
                    {cancellations.length.toLocaleString("ko-KR")}건
                  </b>
                </p>
                <div>
                  {cancellations.map((item, i) => (
                    <CancellationRow
                      key={`${item.apt}-${item.dealDate}-${item.priceKrw}-${i}`}
                      item={item}
                      divider={i > 0}
                    />
                  ))}
                </div>
                <CornerNote>
                  계약 해제는 국토부 공개 행정 사실이며, 해제 사유는 알 수 없습니다 · 국토부는
                  신고가 신고 후 해제 행위를 별도 조사하고 있습니다{mergedNote}.
                </CornerNote>
              </section>
            )}
          </>
        )}

        {/* ── [내 문턱 · 구독자란] — 옵트인 로컬 프로필 있을 때만(클라이언트가 자체 렌더) ── */}
        <ThresholdGauge />

        {/* ── CTA — 코랄은 제호 플레이트와 CTA·판정 링크에만 ── */}
        <a
          href="#biji-verdict"
          className="mt-3 block w-full py-[13px] text-center text-[15px] font-extrabold tracking-[0.04em] text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2"
          style={{ background: CORAL, outlineColor: INK }}
        >
          그래서 이 동네들, 내 통장으론? — 30초 판정
        </a>

        {/* ── 콜로폰 ── */}
        <div
          className="mt-3.5 flex justify-between pt-2.5 text-[10px] leading-[1.6]"
          style={{ borderTop: `2.5px solid ${INK}`, color: INK_SOFT }}
        >
          <span>
            국토부 실거래 공개분 기준 · 신고는 계약 후 최대 30일
            <br />
            실거래 기록 판독이며 투자 권유가 아닙니다
          </span>
          <span className="text-right">
            다음 호
            <br />
            내일 새벽 5:30
          </span>
        </div>
      </div>
    </section>
  );
}
