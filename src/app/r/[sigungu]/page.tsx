// 동네면 /r/[시군구] — 81개 시군구 정적 지면 (v2.3, 2026-07-06 사장 확정).
//
// 구성(위→아래): 정보띠 → 헤더("{시군구} — 비집고 동네면", 명조) → [오늘 이 동네]
//   → [12개월 추이](거래량 막대 + 관측 중위가 라인, 서버 렌더 SVG) → 출구(30초 판정)
//   → 콜로폰(지면과 동일 면책).
//
// 편집 헌장: ①인쇄되는 건 팩트뿐 — "시세" 단정 금지, 시계열 라벨은 "실거래 관측값"
// ②숫자엔 기준·날짜 병기 ③사람 말 ④모든 정보엔 출구 ⑤하락 특정 단지 실명 금지.
//
// 데이터는 전부 빌드 타임 JSON — dailyPatch.json(매일 새벽 5:30 크론 커밋 → 재배포로
// 지면 갱신), regionSeries.json(일요일 주간 크론). placeholder(generatedAt null)에서도
// 빌드가 통과하도록 두 파일 모두 graceful 폴백을 갖는다.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import dailyPatchRaw from "@/data/dailyPatch.json";
import regionSeriesRaw from "@/data/regionSeries.json";
import regionTopRaw from "@/data/regionTop.json";
import { LAWD_CODES, SIGUNGU_NAMES } from "@/lib/molit";
import {
  medianLineSegments,
  priceAxis,
  regionSeriesSummary,
  type RegionSeriesEntry,
  type RegionSeriesFile,
} from "@/lib/regionSeries";
import {
  REGION_TOP_BANDS,
  orderedBandKeys,
  type RegionTopFile,
  type RegionTopItem,
} from "@/lib/regionTop";
import {
  passesStrongGate,
  ymdShortText,
  type BusiestRegion,
  type CancellationItem,
  type MajorItem,
  type PatchItem,
} from "@/lib/patchNote";
import { ShareButton } from "@/components/ShareButton";
// 지면 조판 토큰·명조 — 공유 단일 소스(중복 선언 금지). UP/DOWN = 시세 방향색(1면과 동일 문법).
import { serif, PAPER, INK, INK_SOFT, RULE, CORAL, UP, DOWN } from "@/lib/paperTone";

// ── 라우팅 — LAWD_CODES 81개 키가 곧 전체 지면 목록. 미지 파라미터는 404. ──────
export const dynamicParams = false;

export function generateStaticParams(): { sigungu: string }[] {
  return Object.keys(LAWD_CODES).map((sigungu) => ({ sigungu }));
}

/** URL 세그먼트 → 시군구 풀네임. decode 후 SIGUNGU_NAMES 화이트리스트 검증
 *  (공백 포함 "수원시 팔달구"는 %20 으로 온다). 미지 값·깨진 인코딩은 null → 404. */
function resolveSigungu(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return SIGUNGU_NAMES.has(decoded) ? decoded : null;
}

// ── 빌드 타임 데이터 (placeholder 허용 — 필드 전부 방어적으로 읽는다) ────────────
interface DailyPatchSubset {
  generatedAt: string | null;
  mode?: "bootstrap" | "daily" | "merged";
  mergedFromDate?: string | null;
  mergedToDate?: string | null;
  nerf: PatchItem[];
  major?: MajorItem[];
  cancellations?: CancellationItem[];
  busiestRegions?: BusiestRegion[];
}
const patch = dailyPatchRaw as unknown as DailyPatchSubset;
const series = regionSeriesRaw as unknown as RegionSeriesFile;
const regionTop = regionTopRaw as unknown as RegionTopFile;

// ── 포맷터 — DailyFront 지면과 동일 규칙(그쪽은 컴포넌트 프라이빗이라 미러) ───────
/** "2026-06-28" → "6/28". 깨진 값은 그대로. (당일·당월성 표기 전용 — 계약일 등) */
function md(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[1])}/${Number(m[2])}` : date;
}
/** "2026-06-18" → "'26.6.18" — 직전/종전 비교 표기 전용(연도 병기 의무, 1면과 단일 규칙). */
const ymdShort = ymdShortText;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
/** "2026-07-06" → "2026년 7월 6일 월요일". */
function koDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return date;
  const d = new Date(`${m[0].slice(0, 10)}T00:00:00Z`);
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일 ${WEEKDAYS[d.getUTCDay()]}요일`;
}
/** 원 → "18.5억" (소수 1자리, .0 생략). */
function eok(krw: number): string {
  const v = krw / 100_000_000;
  const s = v.toFixed(1);
  return `${s.endsWith(".0") ? s.slice(0, -2) : s}억`;
}
/** 전용면적 → "84.9" (.0 생략). */
function sqm(area: number): string {
  const s = area.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}
/** 등락률(소수) → "8.8" (절대값). */
function pctAbs(pct: number): string {
  const s = (Math.abs(pct) * 100).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}
/** "2025-07" → "25.7" (차트 월 눈금). */
function ymShort(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? `${m[1].slice(2)}.${Number(m[2])}` : ym;
}

// ── metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sigungu: string }>;
}): Promise<Metadata> {
  const { sigungu: raw } = await params;
  const sigungu = resolveSigungu(raw);
  if (!sigungu) return { title: "비집고 — 내 통장으로 비집고 들어갈 집" };
  const title = `${sigungu} 아파트 오늘 공개 실거래·12개월 추이 — 비집고`;
  const description = `${sigungu} 오늘 공개된 아파트 실거래(국토부 공개분, 매일 아침 갱신)와 최근 12개월 거래량·관측 중위가. 해제·직거래 제외 — 시세 지수가 아닌 실거래 관측값.`;
  const path = `/r/${encodeURIComponent(sigungu)}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, type: "website", url: path },
    twitter: { title, description, card: "summary" },
  };
}

// ── 조판 부품 (DailyFront 미러 — 코너 라벨/각주) ─────────────────────────────────
/** 코너 라벨 + 라인 우측 끝 미세 출처 워터마크 "bijigo.kr" — 어느 코너를 스크린샷해도
 *  출처가 담긴다(2026-07-07 사장 지시). 코너당 1개·10px·소문자·링크 아님(절제). */
function CornerLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <span
        className="inline-block px-2 py-[3px] text-[11px] font-bold tracking-[0.18em]"
        style={{ background: INK, color: PAPER }}
      >
        {children}
      </span>
      <span
        aria-hidden="true"
        className="shrink-0 text-[10px] tracking-[0.04em]"
        style={{ color: INK_SOFT }}
      >
        bijigo.kr
      </span>
    </div>
  );
}
function CornerNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[10.5px] leading-[1.55]" style={{ color: INK_SOFT }}>
      {children}
    </p>
  );
}

// ── [12개월 추이] 차트 — 서버 렌더 순수 SVG(라이브러리 금지). ────────────────────
// 막대 = 거래량(괘선색), 라인 = 관측 중위가(먹). 표본 부족(null) 달은 라인 끊김.
function RegionSeriesChart({
  sigungu,
  months,
  entry,
}: {
  sigungu: string;
  months: string[];
  entry: RegionSeriesEntry;
}) {
  const W = 640;
  const H = 252;
  const x0 = 12;
  const x1 = 566; // 우측 라벨 여백
  const yTop = 18;
  const yBase = 206; // 플롯 바닥(막대 기준선)
  const n = months.length;
  const slotW = (x1 - x0) / n;
  const barW = slotW * 0.52;
  const cx = (i: number) => x0 + slotW * i + slotW / 2;

  // 막대 스케일 — 월 거래량.
  const maxCount = Math.max(1, ...entry.counts);
  const barH = (c: number) => (c / maxCount) * (yBase - yTop - 26);

  // 라인 스케일 — 동적 y 도메인(관측 중위 min/max ± 여유) + 억 단위 "깔끔한" 눈금
  // 2~3개(5천만/1억… 스냅 — priceAxis). TempTrendChart의 동적 도메인과 같은 사상.
  const meds = entry.medianKrw.filter((v): v is number => v !== null);
  const axis = meds.length > 0 ? priceAxis(Math.min(...meds), Math.max(...meds)) : null;
  const yPlotTop = yTop + 14; // 상단 캡션("막대 = …") 아래
  const yPlotBot = yBase - 12; // 막대 기준선 위
  const yMed = (v: number) =>
    axis
      ? yPlotBot -
        ((v - axis.domainMin) / (axis.domainMax - axis.domainMin)) * (yPlotBot - yPlotTop)
      : (yTop + yBase) / 2;

  const segments = medianLineSegments(entry.medianKrw);

  // 값 라벨 — 마지막 관측점 + 전 구간 최고점(다른 달일 때만). 숫자엔 기준 병기(각주).
  let lastIdx = -1;
  let maxIdx = -1;
  entry.medianKrw.forEach((v, i) => {
    if (v === null) return;
    lastIdx = i;
    if (maxIdx < 0 || v > (entry.medianKrw[maxIdx] as number)) maxIdx = i;
  });
  const labels: { i: number; v: number; anchor: "start" | "middle" | "end"; dy: number }[] = [];
  if (lastIdx >= 0)
    labels.push({ i: lastIdx, v: entry.medianKrw[lastIdx]!, anchor: "start", dy: 4 });
  if (maxIdx >= 0 && maxIdx !== lastIdx)
    labels.push({ i: maxIdx, v: entry.medianKrw[maxIdx]!, anchor: "middle", dy: -8 });

  // 월 눈금 — 처음·중간·끝 (13개월이면 0/6/12).
  const tickIdx = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`${sigungu} 최근 ${n}개월 거래량 막대와 관측 중위가 라인 차트. 월 최다 ${maxCount}건${
        lastIdx >= 0 ? `, 최근 관측 중위 ${eok(entry.medianKrw[lastIdx]!)}` : ""
      }.`}
    >
      {/* 기준선(괘선) */}
      <line x1={x0} y1={yBase} x2={x1 + 40} y2={yBase} stroke={INK} strokeWidth="1.5" />
      {/* y축 가격 눈금 + 가는 그리드선 — 관측 중위가 라인 전용 축(막대 축은 별도 —
          캡션 "월 최다 N건"으로 표기). 눈금은 전부 5천만의 배수. */}
      {axis?.ticks.map((t) => (
        <g key={`g${t}`}>
          <line
            x1={x0}
            y1={yMed(t).toFixed(1)}
            x2={x1 + 40}
            y2={yMed(t).toFixed(1)}
            stroke={RULE}
            strokeWidth="0.8"
            strokeDasharray="2 3"
          />
          <text x={x0} y={(yMed(t) - 4).toFixed(1)} fontSize="10" fill={INK_SOFT}>
            {eok(t)}
          </text>
        </g>
      ))}
      {/* 거래량 막대 */}
      {entry.counts.map((c, i) =>
        c > 0 ? (
          <rect
            key={`b${i}`}
            x={cx(i) - barW / 2}
            y={yBase - barH(c)}
            width={barW}
            height={barH(c)}
            fill={RULE}
          />
        ) : null,
      )}
      {/* 막대 스케일 안내 — 월 최다 건수 */}
      <text x={x0} y={yTop - 5} fontSize="10.5" fill={INK_SOFT}>
        막대 = 거래량 (월 최다 {maxCount}건) · 선 = 관측 중위가
      </text>
      {/* 관측 중위가 라인 — null 달에서 끊김. 고립 1점은 점으로. */}
      {segments.map((seg, si) =>
        seg.length === 1 ? (
          <circle key={`s${si}`} cx={cx(seg[0].i)} cy={yMed(seg[0].v)} r="3.5" fill={INK} />
        ) : (
          <polyline
            key={`s${si}`}
            points={seg.map((p) => `${cx(p.i)},${yMed(p.v)}`).join(" ")}
            fill="none"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ),
      )}
      {/* 관측점 */}
      {segments.flat().map((p) => (
        <circle key={`p${p.i}`} cx={cx(p.i)} cy={yMed(p.v)} r="2.4" fill={INK} />
      ))}
      {/* 값 라벨 — 마지막 관측·전 구간 최고 */}
      {labels.map((l) => (
        <text
          key={`l${l.i}`}
          x={l.anchor === "start" ? cx(l.i) + 7 : cx(l.i)}
          y={yMed(l.v) + l.dy}
          fontSize="12"
          fontWeight="700"
          fill={INK}
          textAnchor={l.anchor}
        >
          {eok(l.v)}
        </text>
      ))}
      {/* 월 눈금 */}
      {tickIdx.map((i) => (
        <text
          key={`t${i}`}
          x={cx(i)}
          y={yBase + 17}
          fontSize="10.5"
          fill={INK_SOFT}
          textAnchor="middle"
        >
          {ymShort(months[i])}
        </text>
      ))}
    </svg>
  );
}

// ── [오늘 이 동네] 행 — 지면 톤 미니 행(미니맵 없음 — 동네면은 텍스트 팩트만). ────
function DealLine({
  left,
  meta,
  right,
  sub,
  divider,
}: {
  left: string;
  meta?: string;
  right: string;
  sub?: string;
  divider: boolean;
}) {
  return (
    <div
      className={`py-[5.5px] tabular-nums ${divider ? "border-t border-dotted" : ""}`}
      style={divider ? { borderColor: RULE } : undefined}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: INK }}>
          {left}{" "}
          {meta && (
            <span className="text-[11px] font-normal" style={{ color: INK_SOFT }}>
              {meta}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right text-[13px] font-bold" style={{ color: INK }}>
          {right}
        </span>
      </div>
      {sub && (
        <div className="mt-[1px] text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── [최근 거래 상위] 행 — 순위 + 단지(카카오맵 링크) + 가격, 직전 거래 있으면 대비 병기. ──
// 좌표 미보유 데이터라 DealLocation(미니맵 details) 대신 검색 딥링크만 — 행 전체가 링크.
function TopRow({
  item,
  rank,
  sigungu,
  divider,
}: {
  item: RegionTopItem;
  rank: number;
  sigungu: string;
  divider: boolean;
}) {
  const pct =
    item.prevKrw != null && item.prevKrw > 0
      ? (item.priceKrw - item.prevKrw) / item.prevKrw
      : null;
  const dir = pct == null || pct === 0 ? INK : pct > 0 ? UP : DOWN;
  const sign = pct == null ? "" : pct > 0 ? "+" : pct < 0 ? "−" : "±";
  return (
    <a
      href={`https://map.kakao.com/link/search/${encodeURIComponent(`${sigungu} ${item.apt}`)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`block py-[5.5px] tabular-nums ${divider ? "border-t border-dotted" : ""}`}
      style={divider ? { borderColor: RULE } : undefined}
    >
      <div className="flex items-baseline gap-2">
        <span className="w-[18px] shrink-0 text-right text-[12px] font-bold" style={{ color: INK_SOFT }}>
          {rank}.
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: INK }}>
          {item.dong} {item.apt}{" "}
          <span className="text-[11px] font-normal" style={{ color: INK_SOFT }}>
            {sqm(item.areaM2)}㎡{item.floor != null ? ` · ${item.floor}층` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right text-[13px] font-bold" style={{ color: INK }}>
          {eok(item.priceKrw)}{" "}
          <span className="text-[11px] font-normal" style={{ color: INK_SOFT }}>
            계약 {md(item.dealDate)}
          </span>
        </span>
      </div>
      {pct != null && item.prevDate != null && item.prevKrw != null && (
        <div className="mt-[1px] pl-[26px] text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
          직전 {ymdShort(item.prevDate)} {eok(item.prevKrw)} 대비{" "}
          <b style={{ color: dir }}>
            {sign}
            {pctAbs(pct)}%
          </b>
        </div>
      )}
    </a>
  );
}

/** 밴드 섹션 — 라벨 칩 + 행 목록. 탭 강제 금지(헌장 6조 "조작하지 않는다, 읽는다"):
 *  두 밴드를 접기 없이 연속 게재하고, 거래 많은 밴드가 위(orderedBandKeys). */
function TopBandSection({
  label,
  deals,
  items,
  sigungu,
}: {
  label: string;
  deals: number;
  items: RegionTopItem[];
  sigungu: string;
}) {
  return (
    <div className="pt-1.5 first:pt-0">
      <p className="m-0 text-[11px] font-bold tracking-[0.08em]" style={{ color: INK_SOFT }}>
        <span
          className="mr-1.5 inline-block border px-1.5 py-[1px] text-[10.5px]"
          style={{ borderColor: INK, color: INK }}
        >
          {label}
        </span>
        최근 60일 관측 {deals.toLocaleString("ko-KR")}건
      </p>
      {items.map((it, i) => (
        <TopRow
          key={`${it.apt}-${it.dealDate}-${it.priceKrw}`}
          item={it}
          rank={i + 1}
          sigungu={sigungu}
          divider={i > 0}
        />
      ))}
    </div>
  );
}

// ── 페이지 ───────────────────────────────────────────────────────────────────
export default async function Page({
  params,
}: {
  params: Promise<{ sigungu: string }>;
}) {
  const { sigungu: raw } = await params;
  const sigungu = resolveSigungu(raw);
  if (!sigungu) notFound();

  // [오늘 이 동네] — dailyPatch 에서 이 시군구만 필터.
  const isMerged =
    patch.mode === "merged" && !!patch.mergedFromDate && !!patch.mergedToDate;
  const mergedNote = isMerged
    ? ` · 주말 합산 ${md(patch.mergedFromDate!)}~${md(patch.mergedToDate!)} 공개분`
    : "";
  const majors = (patch.major ?? []).filter((m) => m.sigungu === sigungu);
  // [강세] 게재 요건은 1면과 동일 — 오보 게이트(passesStrongGate: 직전 거래 팩트 +
  // 이중 합의 +7% + 상한 +30%) 통과분만. 게이트 이전 크론 데이터도 렌더에서 걸러진다.
  const strongs = patch.nerf.filter(
    (i) => i.sigungu === sigungu && i.prevDate != null && passesStrongGate(i),
  );
  const cancellations = (patch.cancellations ?? []).filter((c) => c.sigungu === sigungu);
  const busiestRank = (patch.busiestRegions ?? []).findIndex((b) => b.sigungu === sigungu);
  const busiest = busiestRank >= 0 ? (patch.busiestRegions ?? [])[busiestRank] : null;
  const hasToday =
    patch.generatedAt !== null &&
    (majors.length > 0 || strongs.length > 0 || cancellations.length > 0 || busiest !== null);

  // [12개월 추이] — regionSeries. placeholder(generatedAt null)·미수록 동네는 안내 문구.
  const entry: RegionSeriesEntry | null =
    series.generatedAt !== null && series.months.length > 0
      ? (series.regions[sigungu] ?? null)
      : null;
  // 12개월 요약 한 줄 — 유효(중위가 인쇄) 월 2개 미만이면 생략.
  const summary = entry ? regionSeriesSummary(series.months, entry) : null;
  const summaryDir =
    summary == null || summary.pct === 0 ? INK : summary.pct > 0 ? UP : DOWN;

  // [최근 거래 상위] — regionTop. placeholder·미수록 동네는 안내 문구.
  // 탭 강제 금지 — 거래 많은 밴드가 위, 두 밴드 연속 게재(무조작 완결).
  const topBands =
    regionTop.generatedAt !== null ? (regionTop.regions[sigungu] ?? null) : null;
  const topOrder = topBands ? orderedBandKeys(topBands) : [];

  return (
    <div className="mx-auto w-full max-w-md px-0 py-4 sm:py-6">
      <article
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
            {patch.generatedAt ? koDate(patch.generatedAt) : "창간 준비호"}
            {isMerged && (
              <>
                {" "}
                · 주말 합산 {md(patch.mergedFromDate!)}~{md(patch.mergedToDate!)} 공개분
              </>
            )}
          </span>
          <Link href="/" className="underline decoration-dotted underline-offset-2" style={{ color: INK_SOFT }}>
            오늘의 1면 →
          </Link>
        </div>

        {/* ── 헤더 — "{시군구} — 비집고 동네면" (명조 제호 미니) ── */}
        <header
          className="px-0.5 pb-2.5 pt-3"
          style={{ borderTop: `2.5px solid ${INK}`, borderBottom: `1px solid ${INK}` }}
        >
          <h1 className={`${serif.className} m-0 text-[24px] font-extrabold leading-[1.3] break-keep`}>
            {sigungu}{" "}
            <span className="text-[15px] font-bold tracking-[0.06em]" style={{ color: INK_SOFT }}>
              — 비집고 동네면
            </span>
          </h1>
        </header>

        {/* ── [오늘 이 동네] ── */}
        <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
          <CornerLabel>오늘 이 동네</CornerLabel>
          {!hasToday ? (
            <CornerNote>
              오늘 공개분에 이 동네 거래 없음 · 다음 호 내일 아침
            </CornerNote>
          ) : (
            <>
              {busiest && (
                <p className="m-0 pb-1 text-[12.5px] leading-[1.6] tabular-nums" style={{ color: INK_SOFT }}>
                  {isMerged ? "이번 합산에서" : "오늘"} 가장 많이 공개된 동네{" "}
                  <b style={{ color: INK }}>{busiestRank + 1}위</b> —{" "}
                  <b className="tabular-nums" style={{ color: INK }}>
                    {busiest.count.toLocaleString("ko-KR")}건
                  </b>{" "}
                  공개
                </p>
              )}

              {majors.length > 0 && (
                <div className="pt-1">
                  <p className="m-0 text-[11px] font-bold tracking-[0.08em]" style={{ color: INK_SOFT }}>
                    주요 거래(15억 이상 중개거래)
                  </p>
                  {majors.map((m, i) => (
                    <DealLine
                      key={`m${m.apt}-${m.dealDate}-${m.priceKrw}-${i}`}
                      left={`${m.dong} ${m.apt}`}
                      meta={`${sqm(m.areaM2)}㎡${m.floor != null ? ` · ${m.floor}층` : ""}`}
                      right={`${eok(m.priceKrw)} · 계약 ${md(m.dealDate)}`}
                      divider={i > 0}
                    />
                  ))}
                </div>
              )}

              {strongs.length > 0 && (
                <div className="pt-1.5">
                  <p className="m-0 text-[11px] font-bold tracking-[0.08em]" style={{ color: INK_SOFT }}>
                    강세 거래(직전 실거래보다 높게)
                  </p>
                  {strongs.map((s, i) => (
                    <DealLine
                      key={`s${s.apt}-${s.dealDate}-${i}`}
                      left={`▲ ${s.dong} ${s.apt}`}
                      meta={`${sqm(s.areaM2)}㎡`}
                      right={`+${pctAbs(s.pctVsPrev!)}%`}
                      sub={`직전 ${ymdShort(s.prevDate!)} ${eok(s.prevKrw!)}${s.prevFloor != null ? `(${s.prevFloor}층)` : ""} → ${eok(s.priceKrw)} · 계약 ${md(s.dealDate)}`}
                      divider={i > 0}
                    />
                  ))}
                </div>
              )}

              {cancellations.length > 0 && (
                <div className="pt-1.5">
                  <p className="m-0 text-[11px] font-bold tracking-[0.08em]" style={{ color: INK_SOFT }}>
                    오늘 등록된 해제거래(국토부 공개 행정 사실 — 사유는 알 수 없음)
                  </p>
                  {cancellations.map((c, i) => (
                    <DealLine
                      key={`c${c.apt}-${c.dealDate}-${c.priceKrw}-${i}`}
                      left={`${c.dong} ${c.apt}`}
                      meta={`${sqm(c.areaM2)}㎡`}
                      right={`${eok(c.priceKrw)} · 계약 ${md(c.dealDate)}`}
                      sub={c.wasTopInWindow ? "— 해제 전까지 이 단지 최고가로 공개돼 있었음" : undefined}
                      divider={i > 0}
                    />
                  ))}
                </div>
              )}

              <CornerNote>
                {isMerged ? "합산 기간에" : "오늘"} 공개된 이 동네 항목만 발췌 · 주요·강세
                거래는 직거래·해제 제외{mergedNote} · 전체 지면은{" "}
                <Link href="/" className="underline decoration-dotted underline-offset-2" style={{ color: INK }}>
                  오늘의 1면
                </Link>
                에.
              </CornerNote>
            </>
          )}
        </section>

        {/* ── [12개월 추이] ── */}
        <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
          <CornerLabel>12개월 추이</CornerLabel>
          {!entry ? (
            <CornerNote>추이 데이터는 일요일 주간 갱신부터 채워집니다.</CornerNote>
          ) : (
            <>
              {summary && (
                <p
                  className="m-0 pb-1 text-[12.5px] leading-[1.6] tabular-nums"
                  style={{ color: INK_SOFT }}
                >
                  관측 중위 <b style={{ color: INK }}>{eok(summary.firstKrw)}</b> →{" "}
                  <b style={{ color: INK }}>{eok(summary.lastKrw)}</b>{" "}
                  <b style={{ color: summaryDir }}>
                    ({summary.pct > 0 ? "+" : summary.pct < 0 ? "−" : "±"}
                    {pctAbs(summary.pct)}%)
                  </b>{" "}
                  · 거래 최다 {ymShort(summary.busiestYm)}(
                  {summary.busiestCount.toLocaleString("ko-KR")}건)
                </p>
              )}
              <RegionSeriesChart sigungu={sigungu} months={series.months} entry={entry} />
              <CornerNote>
                국토부 실거래 관측값(해제·직거래 제외, 평형 혼합 중위) — 시세 지수가
                아닙니다. 월 3건 미만은 중위가 생략(표본 부족) · 당월은 신고 지연(최대
                30일)으로 집계 중
                {series.generatedAt ? ` · 주간 갱신 ${md(series.generatedAt.slice(0, 10))}` : ""}.
              </CornerNote>
            </>
          )}
        </section>

        {/* ── [최근 거래 상위] — 59㎡급/84㎡급 연속 게재(거래 많은 밴드가 위, 무조작 완결) ── */}
        <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
          <CornerLabel>최근 거래 상위</CornerLabel>
          {topOrder.length === 0 ? (
            <CornerNote>최근 거래 상위는 일요일 주간 갱신부터 채워집니다.</CornerNote>
          ) : (
            <>
              {topOrder.map((key) => {
                const cell = topBands![key]!;
                const band = REGION_TOP_BANDS.find((b) => b.key === key)!;
                return (
                  <TopBandSection
                    key={key}
                    label={band.label}
                    deals={cell.deals}
                    items={cell.items}
                    sigungu={sigungu}
                  />
                );
              })}
              <CornerNote>
                최근 {regionTop.windowDays ?? 60}일 공개된 중개거래(해제·직거래 제외) ·
                단지당 대표 1건(최신 계약) · 가격순 상위 10 — 시세가 아닌 관측값
                {regionTop.generatedAt
                  ? ` · 주간 갱신 ${md(regionTop.generatedAt.slice(0, 10))}`
                  : ""}
                . 단지를 누르면 카카오맵.
              </CornerNote>
            </>
          )}
        </section>

        {/* ── 출구 — 모든 정보엔 출구(30초 판정) ── */}
        <Link
          href="/#biji-verdict"
          className="mt-3 block w-full py-[13px] text-center text-[15px] font-extrabold tracking-[0.04em] text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2"
          style={{ background: CORAL, outlineColor: INK }}
        >
          이 동네, 내 통장으론? — 30초 판정
        </Link>

        {/* ── 콜로폰 + 공유(콜로폰 옆 소형 버튼) — 지면(1면)과 동일 문법 ── */}
        <div
          className="mt-3.5 flex items-start justify-between gap-3 pt-2.5 text-[10px] leading-[1.6]"
          style={{ borderTop: `2.5px solid ${INK}`, color: INK_SOFT }}
        >
          <span>
            국토부 실거래 공개분 기준 · 신고는 계약 후 최대 30일
            <br />
            실거래 기록 판독이며 투자 권유가 아닙니다
          </span>
          <span className="flex shrink-0 items-center gap-2.5">
            <ShareButton title={`비집고 — ${sigungu} 동네면`} />
            <span className="text-right">
              다음 호
              <br />
              내일 아침
            </span>
          </span>
        </div>
      </article>
    </div>
  );
}
