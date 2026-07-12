// 클릭되는 공유 링크카드 착지 페이지 /s/{kind} (kind = major | strong | weak) —
// 2026-07-11 사장 지시. 이 URL을 스레드·카톡에 붙이면 og:image(같은 세그먼트
// opengraph-image.tsx)가 큰 카드로 언펄되고, 탭하면 이 페이지로 유입된다 → CTA로 홈.
//
// 편집 헌장: ①인쇄되는 건 팩트뿐 ②숫자엔 기준·날짜 병기 ⑤약세는 시군구 집계만 —
// 하락 단지 실명 절대 금지(강세는 실명 OK — 상승). 신규 폰트·npm 의존성 0.
//
// 서버 컴포넌트 · 빌드 타임 JSON(dailyPatch)만 — 요청당 DB 0.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import dailyPatchRaw from "@/data/dailyPatch.json";
import {
  passesStrongGate,
  ymdShortText,
  type MajorItem,
  type PatchItem,
  type PatchTemp,
  type RegionPulse,
} from "@/lib/patchNote";
import tempSeriesRaw from "@/data/tempSeries.json";
import type { TempSeriesFile } from "@/lib/tempSeries";
import { tempStory, tempStoryLine, ymApos } from "@/lib/tempStory";
import { majorAnalysis } from "@/lib/majorAnalysis";
import { areaMeta } from "@/lib/areaLabel";
import { aptDisplayName } from "@/lib/aptName";
import { serif, PAPER, INK, INK_SOFT, RULE, CORAL, UP, DOWN } from "@/lib/paperTone";
import {
  buildShareMap,
  MAP_COLS,
  TILE_BORDER,
  type MapKind,
} from "@/lib/shareMapData";

// ── 라우팅 — 다섯 kind 정적 생성. 그 외 세그먼트는 404. ────────────────────────
export const dynamicParams = false;

type Kind = "major" | "strong" | "weak" | "recovery" | "trade" | "temp";
const KINDS: Kind[] = ["major", "strong", "weak", "recovery", "trade", "temp"];
const MAP_KINDS = ["recovery", "trade"] as const;
function isMapKind(k: Kind): k is MapKind {
  return (MAP_KINDS as readonly string[]).includes(k);
}

export function generateStaticParams(): { kind: Kind }[] {
  return KINDS.map((kind) => ({ kind }));
}

function isKind(v: string): v is Kind {
  return (KINDS as string[]).includes(v);
}

// ── 빌드 타임 데이터 (placeholder 허용 — 필드 방어적으로 읽는다) ─────────────────
interface PatchSubset {
  generatedAt: string | null;
  mode?: "bootstrap" | "daily" | "merged";
  mergedFromDate?: string | null;
  mergedToDate?: string | null;
  major?: MajorItem[];
  nerf?: PatchItem[];
  weakRegions?: RegionPulse[];
  temp?: PatchTemp | null;
}
const patch = dailyPatchRaw as unknown as PatchSubset;
const tempSeries = tempSeriesRaw as unknown as TempSeriesFile;

// ── 포맷터 — 지면(DailyFront·동네면)과 동일 규칙 ──────────────────────────────
/** "2026-06-28" → "6/28". (계약일 등 당일성 표기 전용) */
function md(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[1])}/${Number(m[2])}` : date;
}
/** "2026-06-18" → "'26.6.18" — 직전 비교 표기(연도 병기 의무). */
const ymdShort = ymdShortText;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
/** "2026-07-11" → "2026년 7월 11일 토요일". */
function koDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(`${date}T00:00:00Z`);
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일 ${WEEKDAYS[d.getUTCDay()]}요일`;
}
/** 원 → "18.5억" (소수 1자리, .0 생략). */
function eok(krw: number): string {
  const v = krw / 100_000_000;
  const s = v.toFixed(1);
  return `${s.endsWith(".0") ? s.slice(0, -2) : s}억`;
}
/** 등락률(소수) → 절대값 "8.8"(.0 생략) — 방향은 부호·색으로. */
function pctAbs(pct: number): string {
  const s = (Math.abs(pct) * 100).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}
/** 주요 거래 분석 라인용 짧은 구 이름 — "강남구"→"강남". 복합 시군구는 그대로(오독 방지). */
function shortRegion(sigungu: string): string {
  return sigungu.includes(" ") ? sigungu : sigungu.replace(/[구시군]$/, "");
}

// ── 카드별 제목·설명·표시 상한 ────────────────────────────────────────────────
const PAGE_ROWS = 10; // HTML 본문에 노출하는 행 상한(카드보다 넉넉히).
const KIND_COPY: Record<
  Kind,
  { corner: string; title: string; description: string; right: string }
> = {
  major: {
    corner: "오늘의 주요 거래",
    title: "오늘의 주요 거래 — 수도권 15억 이상 실거래",
    description:
      "오늘 국토부에 공개된 수도권 15억 이상 아파트 중개거래(직거래·해제 제외)를 가격순으로. 매일 아침 갱신 — 비집고.",
    right: "수도권 15억 이상 · 가격순",
  },
  strong: {
    corner: "오늘의 강세 거래",
    title: "오늘의 강세 거래 — 직전 실거래보다 높게 팔린 거래",
    description:
      "같은 단지·평형의 최근 60일 내 직전 실거래보다 눈에 띄게 높게 팔린 중개거래. 이중 합의 게이트로 선별 — 비집고.",
    right: "직전 실거래 대비 · 상승순",
  },
  weak: {
    corner: "오늘의 약세 동네",
    title: "오늘의 약세 동네 — 직전 실거래 대비 평균 하락",
    description:
      "시군구별로 오늘 공개된 중개거래의 직전 실거래 대비 평균 등락. 5건 이상 동네만 — 하락 단지 실명은 싣지 않습니다. 비집고.",
    right: "직전 실거래 대비 평균 · 약세순",
  },
  recovery: {
    corner: "회복률 지도",
    title: "회복률 지도 — 수도권 시군구 전고점 대비 회복률",
    description:
      "수도권 82개 시군구를 전고점 대비 회복률로 색칠한 지도. 국민평형(전용 84㎡급) 실거래 중위 기준 — 시세 지수 아님. 매일 아침 갱신 · 비집고.",
    right: "전고점 대비 회복률 · 국민평형",
  },
  trade: {
    corner: "오늘의 거래 지도",
    title: "오늘의 거래 지도 — 수도권 시군구 오늘 공개 실거래",
    description:
      "오늘 국토부에 공개된 수도권 시군구별 실거래 건수를 색 농도로 그린 지도. 직거래·해제 제외 · 매일 아침 갱신 · 비집고.",
    right: "오늘 공개 건수 · 시군구",
  },
  temp: {
    corner: "오늘의 온도",
    title: "오늘의 온도 — 직전 실거래보다 높게 팔린 비율",
    description:
      "오늘 공개된 수도권 아파트 실거래 중 직전 실거래보다 높게 팔린 비율을 폭등기('20.11~'21.10)·급락기('22) 관측 평균, 시계열 최저점과 나란히. 판정 없이 관측값만 — 매일 아침 갱신 · 비집고.",
    right: "직전 실거래 대비 · 계약월 기준",
  },
};

// ── metadata — 큰 카드 언펄 필수(twitter summary_large_image) ─────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>;
}): Promise<Metadata> {
  const { kind } = await params;
  if (!isKind(kind)) return { title: "비집고 — 내 통장으로 비집고 들어갈 집" };
  const { title, description } = KIND_COPY[kind];
  const path = `/s/${kind}`;
  return {
    title: `${title} | 비집고`,
    description,
    alternates: { canonical: path },
    // og:image 는 같은 세그먼트 opengraph-image.tsx 가 자동 주입 — 여기서 images 미지정.
    openGraph: { title, description, type: "website", url: path },
    twitter: { title, description, card: "summary_large_image" },
  };
}

// ── 조판 부품(지면 미러) ──────────────────────────────────────────────────────
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

// ── 페이지 ───────────────────────────────────────────────────────────────────
export default async function Page({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind: raw } = await params;
  if (!isKind(raw)) notFound();
  const kind = raw;
  const copy = KIND_COPY[kind];

  const isMerged =
    patch.mode === "merged" && !!patch.mergedFromDate && !!patch.mergedToDate;
  const mergedNote = isMerged
    ? ` · 주말 합산 ${md(patch.mergedFromDate!)}~${md(patch.mergedToDate!)} 공개분`
    : "";

  const majors = patch.major ?? [];
  const strongs = (patch.nerf ?? []).filter(
    (i) => i.prevDate != null && passesStrongGate(i),
  );
  const weaks = patch.weakRegions ?? [];
  // 지도 카드(회복률·거래) — 타일·범례·콜아웃(HTML은 CSS grid로 그린다).
  const shareMap = isMapKind(kind) ? buildShareMap(kind) : null;
  // 온도 카드(2026-07-12 사장) — 오늘 vs 폭등기·급락기·최저점 관측값 나란히.
  const story = kind === "temp" ? tempStory(tempSeries, patch.temp ?? null) : null;
  const storyLine = story ? tempStoryLine(story) : null;

  const hasData = shareMap
    ? shareMap.tiles.length > 0 // 82개 타일 상수 → 항상 렌더(색만 데이터에 따름)
    : kind === "temp"
      ? story !== null
      : patch.generatedAt !== null &&
        (kind === "major"
          ? majors.length > 0
          : kind === "strong"
            ? strongs.length > 0
            : weaks.length > 0);

  const majorsShown = majors.slice(0, PAGE_ROWS);
  const strongsShown = strongs.slice(0, PAGE_ROWS);
  // [주요 거래 분석] — 구별 직전 대비 평균(+건수). 구 전체 시세 아님(라벨·건수로 명시).
  const majorAgg = kind === "major" ? majorAnalysis(majors) : [];

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
          <span>{patch.generatedAt ? koDate(patch.generatedAt) : "창간 준비호"}</span>
          <Link
            href="/"
            className="underline decoration-dotted underline-offset-2"
            style={{ color: INK_SOFT }}
          >
            오늘의 1면 →
          </Link>
        </div>

        {/* ── 헤더 — 제호 미니(명조) ── */}
        <header
          className="px-0.5 pb-2.5 pt-3"
          style={{ borderTop: `2.5px solid ${INK}`, borderBottom: `1px solid ${INK}` }}
        >
          <h1 className={`${serif.className} m-0 text-[22px] font-extrabold leading-[1.3] break-keep`}>
            {copy.corner}{" "}
            <span className="text-[14px] font-bold tracking-[0.06em]" style={{ color: INK_SOFT }}>
              — 비집고
            </span>
          </h1>
        </header>

        {/* ── 코너 본문 ── */}
        <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
          <CornerLabel>{copy.corner.replace(/^오늘의 /, "")}</CornerLabel>

          {!hasData ? (
            <CornerNote>
              오늘 공개분엔 해당 거래가 없었습니다 · 다음 호 내일 아침 —{" "}
              <Link
                href="/"
                className="underline decoration-dotted underline-offset-2"
                style={{ color: INK }}
              >
                오늘의 1면
              </Link>
              에서 전체 보기
            </CornerNote>
          ) : shareMap ? (
            <>
              <div
                className="grid gap-[2px]"
                style={{ gridTemplateColumns: `repeat(${MAP_COLS}, minmax(0, 1fr))` }}
              >
                {shareMap.tiles.map((t) => (
                  <a
                    key={t.sigungu}
                    href={`/r/${encodeURIComponent(t.sigungu)}`}
                    title={`${t.sigungu} — 동네면`}
                    className="flex aspect-square items-center justify-center text-center text-[8px] font-bold leading-[1.05] tracking-[-0.02em]"
                    style={{
                      gridColumn: t.col,
                      gridRow: t.row,
                      background: t.fill,
                      color: t.text,
                      border: `1px solid ${TILE_BORDER}`,
                    }}
                  >
                    {t.label}
                  </a>
                ))}
              </div>
              {/* 범례 */}
              <div
                className="mt-[7px] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9.5px]"
                style={{ color: INK_SOFT }}
              >
                {shareMap.legend.map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-[10px] w-[10px]"
                      style={{ background: l.bg, border: `1px solid ${TILE_BORDER}` }}
                    />
                    {l.label}
                  </span>
                ))}
              </div>
              {shareMap.callouts.length > 0 && (
                <p className="mt-2 text-[12px] leading-[1.6]" style={{ color: INK_SOFT }}>
                  <span className="mr-1 font-bold" style={{ color: INK }}>
                    {kind === "recovery" ? "회복 최상위" : "가장 활발"}
                  </span>
                  {shareMap.callouts.map((c, i) => (
                    <span key={c.sigungu}>
                      {i > 0 ? " · " : " "}
                      {c.sigungu}{" "}
                      <b style={{ color: kind === "recovery" ? UP : INK }}>{c.value}</b>
                    </span>
                  ))}
                </p>
              )}
              <CornerNote>
                타일 = 수도권 82개 시군구(위치 근사) · 탭하면 동네면으로 ·{" "}
                {kind === "recovery"
                  ? "농도 = 전고점 대비 회복률(국민평형 실거래 중위) · 시세 지수 아님."
                  : "농도 = 오늘 국토부 공개 실거래 건수 · 직거래·해제 제외."}
              </CornerNote>
            </>
          ) : kind === "temp" && story ? (
            <>
              {/* 오늘 크게 + 게이지 — 1면 온도 문법 미러. */}
              <p className="m-0 text-[13px] leading-[1.6] tabular-nums" style={{ color: INK_SOFT }}>
                오늘 직전 거래보다 높게{" "}
                <b className="text-[20px]" style={{ color: UP }}>
                  {Math.round(story.todayPct)}%
                </b>{" "}
                <span className="text-[10.5px]">
                  (직전 실거래가 있는 거래 {patch.temp!.matched.toLocaleString("ko-KR")}건 기준)
                </span>
              </p>
              {/* 비교 앵커 표 — 누구나 아는 국면들 옆에 오늘을 나란히(판정 없음). */}
              <div className="mt-2.5">
                {[
                  story.boomAvg !== null
                    ? { label: "폭등기('20.11~'21.10) 관측 평균", pct: story.boomAvg, color: UP }
                    : null,
                  story.slumpAvg !== null
                    ? { label: "급락기('22) 관측 평균", pct: story.slumpAvg, color: DOWN }
                    : null,
                  story.min
                    ? { label: `시계열 최저 (${ymApos(story.min.ym)})`, pct: story.min.pct, color: DOWN }
                    : null,
                ]
                  .filter((r): r is { label: string; pct: number; color: string } => r !== null)
                  .map((r, i) => (
                    <div
                      key={r.label}
                      className={`flex items-baseline justify-between gap-2 py-[5px] tabular-nums ${i > 0 ? "border-t border-dotted" : ""}`}
                      style={i > 0 ? { borderColor: RULE } : undefined}
                    >
                      <span className="text-[12.5px]" style={{ color: INK }}>
                        {r.label}
                      </span>
                      <b className="text-[14px]" style={{ color: r.color }}>
                        {Math.round(r.pct)}%
                      </b>
                    </div>
                  ))}
              </div>
              {storyLine && (
                <p className="m-0 mt-2 text-[12px] font-semibold leading-[1.6] tabular-nums" style={{ color: INK }}>
                  {storyLine}
                </p>
              )}
              <CornerNote>
                온도 = 같은 단지·평형의 직전 실거래(60일 내)보다 높게 팔린 비율 · 계약월 기준 ·
                참조값은 해당 기간 관측 평균(임의 기준 아님) — 판정은 싣지 않습니다. 추이
                차트는 1면에서.
              </CornerNote>
            </>
          ) : kind === "major" ? (
            <>
              {majorAgg.length > 0 && (
                <div className="mb-2">
                  <p className="m-0 text-[12px] leading-[1.6] tabular-nums" style={{ color: INK_SOFT }}>
                    <span className="mr-1 font-bold tracking-[0.04em]" style={{ color: INK }}>
                      오늘 최고 상승 거래 · 직전 대비
                    </span>
                    {/* 주어는 단지(2026-07-12 사장) — "마포 +14.7%"는 구 전체로 읽힘. */}
                    {majorAgg.map((r, i) => (
                      <span key={r.sigungu}>
                        {i > 0 ? " · " : " "}
                        <b style={{ color: UP }}>
                          {shortRegion(r.sigungu)} {aptDisplayName(r.apt)} +{pctAbs(r.topPct)}%
                        </b>
                      </span>
                    ))}
                  </p>
                  <p className="m-0 mt-0.5 text-[10px] leading-[1.5]" style={{ color: INK_SOFT }}>
                    각 구에서 오늘 나온 큰 거래(15억+)의 최고 상승 — 오보 게이트 통과분, 구 전체 시세 아님.
                  </p>
                </div>
              )}
              <div>
                {majorsShown.map((m, i) => (
                  <div
                    key={`${m.apt}-${m.dealDate}-${m.priceKrw}-${i}`}
                    className={`py-[5.5px] tabular-nums ${i > 0 ? "border-t border-dotted" : ""}`}
                    style={i > 0 ? { borderColor: RULE } : undefined}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: INK }}>
                        {m.dong} {aptDisplayName(m.apt)}{" "}
                        <span className="text-[11px] font-normal" style={{ color: INK_SOFT }}>
                          {areaMeta(m.areaM2)}{m.floor != null ? ` · ${m.floor}층` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[13px] font-bold" style={{ color: INK }}>
                        {eok(m.priceKrw)}
                      </span>
                      <span className="w-[54px] shrink-0 text-right text-[11px]" style={{ color: INK_SOFT }}>
                        계약 {md(m.dealDate)}
                      </span>
                    </div>
                    {m.prevKrw != null && m.pctVsPrev != null && (
                      <div className="mt-[2px] text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
                        직전 {eok(m.prevKrw)}
                        {m.prevDate ? ` (${ymdShort(m.prevDate)})` : ""} 대비{" "}
                        <b style={{ color: m.pctVsPrev > 0 ? UP : m.pctVsPrev < 0 ? DOWN : INK }}>
                          {m.pctVsPrev > 0 ? "+" : m.pctVsPrev < 0 ? "−" : "±"}
                          {pctAbs(m.pctVsPrev)}%
                        </b>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <CornerNote>
                {isMerged ? "합산 기간에" : "오늘"} 공개된 수도권 15억 이상 중개거래 · 직거래·해제
                제외 · 가격순 상위 {majorsShown.length}
                {majors.length > majorsShown.length ? ` (전체 ${majors.length}건은 지면에서)` : ""}
                {mergedNote}.
              </CornerNote>
            </>
          ) : kind === "strong" ? (
            <>
              <div>
                {strongsShown.map((s, i) => (
                  <div
                    key={`${s.apt}-${s.dealDate}-${i}`}
                    className={`py-[5.5px] tabular-nums ${i > 0 ? "border-t border-dotted" : ""}`}
                    style={i > 0 ? { borderColor: RULE } : undefined}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: INK }}>
                        {s.dong} {aptDisplayName(s.apt)}{" "}
                        <span className="text-[11px] font-normal" style={{ color: INK_SOFT }}>
                          {areaMeta(s.areaM2)}{s.floor != null ? ` · ${s.floor}층` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[13px] font-extrabold" style={{ color: UP }}>
                        +{pctAbs(s.pctVsPrev!)}%
                      </span>
                    </div>
                    <div className="mt-[1px] text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
                      직전 {ymdShort(s.prevDate!)} {eok(s.prevKrw!)}
                      {s.prevFloor != null ? `(${s.prevFloor}층)` : ""} → {eok(s.priceKrw)} · 계약{" "}
                      {md(s.dealDate)}
                    </div>
                  </div>
                ))}
              </div>
              <CornerNote>
                비교는 <b style={{ color: INK }}>같은 단지·평형의 최근 60일 내 직전 실거래</b> 기준 ·
                단지 최근 거래 기록과 대조해 선별 · 직거래·해제 제외
                {strongs.length > strongsShown.length ? ` · 전체 ${strongs.length}건은 지면에서` : ""}
                {mergedNote}.
              </CornerNote>
            </>
          ) : (
            <>
              <div>
                {weaks.map((r, i) => (
                  <div
                    key={r.sigungu}
                    className={`flex items-baseline gap-2 py-[5.5px] tabular-nums ${i > 0 ? "border-t border-dotted" : ""}`}
                    style={i > 0 ? { borderColor: RULE } : undefined}
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: INK }}>
                      {r.sigungu}
                    </span>
                    <span className="shrink-0 text-right text-[13px] font-extrabold" style={{ color: DOWN }}>
                      직전 거래 대비 평균 −{pctAbs(r.avgPct)}%
                    </span>
                    <span className="w-[40px] shrink-0 text-right text-[11px]" style={{ color: INK_SOFT }}>
                      {r.count}건
                    </span>
                  </div>
                ))}
              </div>
              <CornerNote>
                {isMerged ? "합산 기간에" : "오늘"} 공개된 중개거래의 직전 실거래(같은 단지·평형, 최근
                60일 내) 대비 평균 · 5건 이상 동네만 · 하락 단지 실명은 싣지 않습니다{mergedNote}.
              </CornerNote>
            </>
          )}
        </section>

        {/* ── CTA — 모든 정보엔 출구(홈 유입 깔때기) ── */}
        <Link
          href="/"
          className="mt-3 block w-full py-[13px] text-center text-[15px] font-extrabold tracking-[0.04em] text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2"
          style={{ background: CORAL, outlineColor: INK }}
        >
          비집고 1면 전체 보기 →
        </Link>
        <Link
          href="/#local"
          className="mt-2 block w-full py-[10px] text-center text-[13px] font-bold underline decoration-dotted underline-offset-2"
          style={{ color: INK }}
        >
          우리 동네 설정 →
        </Link>

        {/* ── 콜로폰 — 지면과 동일 면책 ── */}
        <div
          className="mt-3.5 pt-2.5 text-[10px] leading-[1.6]"
          style={{ borderTop: `2.5px solid ${INK}`, color: INK_SOFT }}
        >
          국토부 실거래 공개분 기준 · 신고는 계약 후 최대 30일 · 실거래 기록 판독이며 투자 권유가
          아닙니다.
        </div>
      </article>
    </div>
  );
}
