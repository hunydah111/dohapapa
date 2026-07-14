import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_DOMAIN } from "@/lib/site";
import dailyPatchRaw from "@/data/dailyPatch.json";
import {
  passesStrongGate,
  type MajorItem,
  type PatchItem,
  type RegionPulse,
} from "@/lib/patchNote";
import { majorAnalysis } from "@/lib/majorAnalysis";
import { areaMeta } from "@/lib/areaLabel";
import { aptDisplayName } from "@/lib/aptName";
import { ogSlug } from "@/lib/ogSlug";
import tempSeriesRaw from "@/data/tempSeries.json";
import type { TempSeriesFile } from "@/lib/tempSeries";
import { tempStory, ymApos, type TempStory } from "@/lib/tempStory";
import type { PatchTemp } from "@/lib/patchNote";
import { buildShareMap, MAP_COLS, MAP_ROWS, TILE_BORDER, type MapKind } from "@/lib/shareMapData";

// 클릭되는 공유 링크카드 3종(주요·강세·약세) — 탭하면 홈 유입 (2026-07-11 사장 지시).
// 종전 /card/major(raw PNG 302)는 스레드·카톡에서 이미지로만 떠 탭해도 홈에 안 왔다.
// 이제 /s/{kind} = og:image 단 실제 HTML 페이지가 유입 깔때기, 이 파일은 그 카드 비주얼.
// 카드 문법은 major·동네판 카드(r/[sigungu]/opengraph-image)와 동일 — 제호·표·코랄 밴드.
// 프리미엄 하이브리드(2026-07-11 mock-hybrid 검증): 세리프(나눔명조)=코너 제목·단지명 ·
//   Pretendard=본문·숫자(가격/%=SemiBold)·비집고 워드마크(Bold) · 코랄 밴드 얇게+굵게.
//   Pretendard는 ㎡(U+33A1)·평 글리프 있음 → areaMeta("84.7㎡ · 32~35평") 그대로 OK.
// satori 제약: React Fragment 금지 · undefined 스타일 값 금지(조건부 스프레드만).
export const contentType = "image/png";

// 정사각 2400×2400(2026-07-14 사장 "반반으로 나온다") — 카톡은 1:1 이미지를 크게 그려
// 미리보기에서 이미지가 지배한다. 행 수도 2배 수용. 2x 해상도 유지(뭉개짐 방지).
// (스레드 링크 언펄은 중앙 크롭 가능 — 스레드는 이미지 직접 첨부가 기본 동선이라 수용.)
const SIZE = { width: 2400, height: 2400 };

const PAPER = "#fbfaf6";
const INK = "#191713";
const INK_SOFT = "#5d574c";
const CORAL = "#e8571f";
const UP = "#c9252d";
const DOWN = "#2563a8";

type Kind = "major" | "strong" | "weak" | "recovery" | "trade" | "temp";
const KINDS: Kind[] = ["major", "strong", "weak", "recovery", "trade", "temp"];
const MAP_KINDS = ["recovery", "trade"] as const;
function isMapKind(k: Kind): k is MapKind {
  return (MAP_KINDS as readonly string[]).includes(k);
}

interface PatchLike {
  generatedAt: string | null;
  major?: MajorItem[];
  nerf?: PatchItem[];
  weakRegions?: RegionPulse[];
  temp?: PatchTemp | null;
}
const patch = dailyPatchRaw as unknown as PatchLike;
const tempSeries = tempSeriesRaw as unknown as TempSeriesFile;

/** 온도 추이 폴리라인 SVG(글자 없음 — 폰트 미탑재 환경 회피) → data URI.
 *  참조선(폭등기·급락기 평균)·50% 점선·최저점(파랑)·오늘(빨강) 점 포함. */
function tempChartDataUri(series: TempSeriesFile, story: TempStory, w: number, h: number): string | null {
  const n = series.months.length;
  if (n < 2) return null;
  const X0 = 8;
  const X1 = w - 70;
  const TODAY_X = w - 30;
  const xOf = (i: number) => X0 + (i * (X1 - X0)) / (n - 1);
  const vals: number[] = [story.todayPct];
  if (story.boomAvg !== null) vals.push(story.boomAvg);
  if (story.slumpAvg !== null) vals.push(story.slumpAvg);
  const pts: { x: number; y: number; p: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (!(series.matched[i] > 0)) continue;
    const p = (series.above[i] / series.matched[i]) * 100;
    vals.push(p);
    pts.push({ x: xOf(i), y: 0, p });
  }
  if (pts.length < 2) return null;
  const yMin = Math.min(45, Math.floor((Math.min(...vals) - 4) / 5) * 5);
  const yMax = Math.max(55, Math.ceil((Math.max(...vals) + 4) / 5) * 5);
  const yOf = (p: number) => 12 + ((yMax - p) / (yMax - yMin)) * (h - 24);
  for (const pt of pts) pt.y = yOf(pt.p);
  const todayY = yOf(story.todayPct);
  const line = [...pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`), `${TODAY_X},${todayY.toFixed(1)}`].join(" ");
  const minIdx = story.min ? series.months.indexOf(story.min.ym) : -1;
  const parts: string[] = [
    `<line x1="${X0}" y1="${yOf(50).toFixed(1)}" x2="${w - 8}" y2="${yOf(50).toFixed(1)}" stroke="#c9c3b4" stroke-width="2" stroke-dasharray="7 7"/>`,
  ];
  if (story.boomAvg !== null)
    parts.push(`<line x1="${X0}" y1="${yOf(story.boomAvg).toFixed(1)}" x2="${w - 8}" y2="${yOf(story.boomAvg).toFixed(1)}" stroke="#c9252d" stroke-opacity="0.35" stroke-width="3" stroke-dasharray="12 8"/>`);
  if (story.slumpAvg !== null)
    parts.push(`<line x1="${X0}" y1="${yOf(story.slumpAvg).toFixed(1)}" x2="${w - 8}" y2="${yOf(story.slumpAvg).toFixed(1)}" stroke="#2563a8" stroke-opacity="0.35" stroke-width="3" stroke-dasharray="12 8"/>`);
  parts.push(`<polyline fill="none" stroke="#191713" stroke-width="4.5" points="${line}"/>`);
  if (minIdx >= 0 && story.min)
    parts.push(`<circle cx="${xOf(minIdx).toFixed(1)}" cy="${yOf(story.min.pct).toFixed(1)}" r="10" fill="#2563a8"/>`);
  parts.push(`<circle cx="${TODAY_X}" cy="${todayY.toFixed(1)}" r="12" fill="#c9252d"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// 발행판 슬러그(날짜+내용 해시) — 3단 발행 중 내용이 바뀐 판만 새 URL(2026-07-13 사장
// 제보: 05:20판 캐시가 06:12판 페이지와 어긋남). 미리보기는 스크랩 시점 스냅샷이 한계.
const dateSlug = ogSlug(patch.generatedAt, dailyPatchRaw);
// 캐시 무효화 — v1→v2(하이브리드)→v3(major 상위 7행)→v4(회복률·거래 지도 카드 추가).
const OG_ID = `v6-${dateSlug}`; // v6: 정사각 캔버스(2026-07-14) · v5: 자료 문법

// 카드별 표 행수 상한 — 하단 코랄 밴드 안 침범하는 선. major 카드는 "상위 7개" 고정
// (사장 2026-07-11: 31개 전부는 과함, TOP 7만). 분석 밴드가 1줄이라 7행도 들어간다.
const MAJOR_ROWS = 12;
const MAJOR_ROWS_WITH_AGG = 12;
const STRONG_ROWS = 12;
const WEAK_ROWS = 9;

const META: Record<Kind, { corner: string; right: string; alt: string }> = {
  major: {
    corner: "오늘의 주요 거래",
    right: "수도권 15억 이상 · 가격순",
    alt: "오늘의 주요 거래 — 수도권 큰 실거래 TOP 7 · 비집고",
  },
  strong: {
    corner: "오늘의 강세 거래",
    right: "직전 실거래 대비 · 상승순",
    alt: "오늘의 강세 거래 — 직전 실거래보다 높게 팔린 중개거래 · 비집고",
  },
  weak: {
    corner: "오늘의 약세 동네",
    right: "직전 실거래 대비 평균 · 약세순",
    alt: "오늘의 약세 동네 — 시군구 직전 실거래 대비 평균 하락 · 비집고",
  },
  recovery: {
    corner: "회복률 지도",
    right: "전고점 대비 회복률 · 국민평형",
    alt: "회복률 지도 — 수도권 시군구 전고점 대비 회복률 · 비집고",
  },
  trade: {
    corner: "오늘의 거래 지도",
    right: "오늘 공개 건수 · 시군구",
    alt: "오늘의 거래 지도 — 수도권 시군구 오늘 공개 실거래 건수 · 비집고",
  },
  temp: {
    corner: "오늘의 온도",
    right: "직전 실거래 대비 · 계약월 기준",
    alt: "오늘의 온도 — 직전 실거래보다 높게 팔린 비율, 폭등기·급락기 관측 평균과 비교 · 비집고",
  },
};

function isKind(v: string): v is Kind {
  return (KINDS as string[]).includes(v);
}

export function generateStaticParams(): { kind: Kind }[] {
  return KINDS.map((kind) => ({ kind }));
}

export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  const k: Kind = isKind(kind) ? kind : "major";
  return [{ id: OG_ID, alt: META[k].alt, size: SIZE, contentType }];
}

function koDateShort(iso: string | null): string {
  if (!iso) return "창간 준비호";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : iso;
}

function eok(krw: number): string {
  const v = krw / 100_000_000;
  const s = v.toFixed(1);
  return `${s.endsWith(".0") ? s.slice(0, -2) : s}억`;
}

/** 직전 대비 등락 → "+14.1%" / "−1.4%" (부호·절대값, .0 생략). null이면 빈칸. */
function pctText(pct: number | null | undefined): string | null {
  if (pct == null) return null;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "±";
  const s = (Math.abs(pct) * 100).toFixed(1);
  return `${sign}${s.endsWith(".0") ? s.slice(0, -2) : s}%`;
}

/** 등락률(소수) → 절대값 "8.8"(.0 생략) — 방향은 부호·색으로. */
function pctAbs(pct: number): string {
  const s = (Math.abs(pct) * 100).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** "2026-06-18" → "'26.6.18" — 직전 거래 날짜 병기(연도 의무, 1면과 단일 규칙). */
function ymdShort(dateISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  return m ? `'${m[1].slice(2)}.${Number(m[2])}.${Number(m[3])}` : dateISO;
}

/** 주요 거래 분석 라인용 짧은 구 이름 — "강남구"→"강남". 복합 시군구는 그대로(오독 방지). */
function shortRegion(sigungu: string): string {
  return sigungu.includes(" ") ? sigungu : sigungu.replace(/[구시군]$/, "");
}

export default async function Image({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  // 프리미엄 하이브리드 폰트 로드(mock-hybrid 미러): 나눔명조 Regular + Pretendard 3종.
  const [nanum, preSB, preR, preB] = await Promise.all([
    readFile(join(process.cwd(), "assets/NanumMyeongjo-Regular.ttf")),
    readFile(join(process.cwd(), "assets/Pretendard-SemiBold.otf")),
    readFile(join(process.cwd(), "assets/Pretendard-Regular.otf")),
    readFile(join(process.cwd(), "assets/Pretendard-Bold.otf")),
  ]);
  const { kind: rawKind } = await params;
  const kind: Kind = isKind(rawKind) ? rawKind : "major";
  const meta = META[kind];

  // 폰트 패밀리 토큰 — 세리프(코너 제목·단지명) / Pretendard 3웨이트(본문·숫자·워드마크).
  const SERIF = "Nanum";
  const SANS = "Pretendard";
  const SANS_SB = "PretendardSB";
  const SANS_B = "PretendardB";

  // 카드별 데이터·행·각주·빈상태 문구 — 전부 major 카드 비주얼 미러.
  const majorAll = patch.major ?? [];
  // [주요 거래 분석] — major 카드 상단 어그로 밴드(구별 직전 대비 평균+건수). 구 시세 아님.
  // 카드는 세로 지면이 빠듯해 상위 4개 구만(1면·페이지는 6개) — 밴드 2줄로 압축.
  const majorAgg = kind === "major" ? majorAnalysis(majorAll, 4) : [];
  const strongAll = (patch.nerf ?? []).filter(
    (i) => i.prevDate != null && passesStrongGate(i),
  );
  const weakAll = patch.weakRegions ?? [];

  // 지도 카드(회복률·거래) — 타일·범례·콜아웃. satori는 CSS grid 미지원 → 절대배치로 그린다.
  const shareMap = isMapKind(kind) ? buildShareMap(kind) : null;
  // 온도 카드(2026-07-12 사장) — 오늘 vs 폭등기·급락기·최저점, 추이 차트는 SVG data URI.
  const story = kind === "temp" ? tempStory(tempSeries, patch.temp ?? null) : null;
  const CHART_W = 2176;
  const CHART_H = 900;
  const chartUri = story ? tempChartDataUri(tempSeries, story, CHART_W, CHART_H) : null;
  const CELL = 72; // 타일 한 칸(px, 2x 캔버스)
  const mapW = MAP_COLS * CELL;
  const mapH = MAP_ROWS * CELL;

  const majorCap = majorAgg.length > 0 ? MAJOR_ROWS_WITH_AGG : MAJOR_ROWS;
  const rowCount =
    kind === "temp"
      ? (story ? 1 : 0)
      : kind === "major"
        ? Math.min(majorCap, majorAll.length)
        : kind === "strong"
          ? Math.min(STRONG_ROWS, strongAll.length)
          : Math.min(WEAK_ROWS, weakAll.length);
  const totalCount =
    kind === "temp"
      ? rowCount
      : kind === "major"
        ? majorAll.length
        : kind === "strong"
          ? strongAll.length
          : weakAll.length;
  const restCount = Math.max(0, totalCount - rowCount);
  const hasRows = rowCount > 0;

  const emptyText =
    kind === "temp"
      ? "오늘 온도 표본 부족"
      : kind === "major"
        ? "오늘 공개된 큰 거래 없음"
        : kind === "strong"
          ? "오늘 강세 거래 없음"
          : "오늘 약세 동네 없음";

  const footnote = kind === "temp"
    ? "온도 = 같은 단지·평형 직전 실거래(60일 내)보다 높게 팔린 비율 · 계약월 기준 · 참조 = 해당 기간 관측 평균(임의 기준 아님)"
    : shareMap
    ? kind === "recovery"
      ? "타일 = 수도권 82개 시군구(위치 근사) · 국민평형(전용 84㎡급) 실거래 중위 · 전고점 대비 · 시세 지수 아님"
      : "타일 = 수도권 82개 시군구(위치 근사) · 농도 = 오늘 국토부에 공개된 실거래 건수 · 직거래·해제 제외"
    : kind === "major"
      ? `${restCount > 0 ? `외 ${restCount}건 · ` : ""}% = 같은 단지 직전 실거래 대비 · 전체는 지면에서`
      : kind === "strong"
        ? `${restCount > 0 ? `외 ${restCount}건 · ` : ""}비교는 같은 단지·평형 최근 60일 내 직전 실거래 기준 · 전체는 지면에서`
        : `직전 실거래(같은 단지·평형 60일 내) 대비 평균 · 5건 이상 동네만 · 하락 단지 실명 없음`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          fontFamily: SANS,
        }}
      >
        {/* 정보띠 + 먹 괘선 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "56px 112px 0",
            paddingBottom: 24,
            borderBottom: `10px solid ${INK}`,
            color: INK_SOFT,
            fontSize: 54,
            fontFamily: SANS,
          }}
        >
          <div style={{ display: "flex" }}>{koDateShort(patch.generatedAt)}</div>
          <div style={{ display: "flex" }}>매일 아침 발행 · 국토부 공개분</div>
        </div>

        {/* 제호(소) + 코너명 + 우측 메타 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            margin: "40px 112px 0",
            gap: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              background: CORAL,
              color: PAPER,
              fontSize: 72,
              fontFamily: SANS_B,
              lineHeight: 1,
              padding: "16px 30px 20px",
            }}
          >
            비집고
          </div>
          <div style={{ display: "flex", color: INK, fontSize: 96, fontFamily: SERIF, lineHeight: 1 }}>
            {meta.corner}
          </div>
          <div
            style={{
              display: "flex",
              flex: 1,
              justifyContent: "flex-end",
              color: INK_SOFT,
              fontSize: 52,
              fontFamily: SANS,
            }}
          >
            {meta.right}
          </div>
        </div>

        {/* [주요 거래 분석] 어그로 밴드 — 구별 직전 대비 평균(+건수). major 카드만.
            정직성: 라벨·건수·서브라벨로 "구 전체 시세 아님" 명시(satori nowrap 회피 wrap). */}
        {majorAgg.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              margin: "28px 112px 0",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "baseline",
                fontSize: 40,
              }}
            >
              <div style={{ display: "flex", color: INK, fontFamily: SANS_B, marginRight: 20 }}>
                오늘 최고 상승 거래 · 직전 대비
              </div>
              {/* 주어는 단지(2026-07-12 사장) — 구만 쓰면 구 전체 시세로 읽힘. */}
              {majorAgg.map((r) => (
                <div
                  key={r.sigungu}
                  style={{ display: "flex", flexDirection: "row", alignItems: "baseline", marginRight: 24 }}
                >
                  <div style={{ display: "flex", color: UP, fontFamily: SANS_SB }}>
                    {`${shortRegion(r.sigungu)} ${aptDisplayName(r.apt)} +${pctAbs(r.topPct)}%`}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", color: INK_SOFT, fontSize: 32, fontFamily: SANS, marginTop: 8 }}>
              각 구에서 오늘 나온 큰 거래(15억+)의 최고 상승 — 오보 게이트 통과분, 구 전체 시세 아님
            </div>
          </div>
        )}

        {/* 본문 표 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            // 행 리스트(강세·약세·주요)는 지면처럼 헤더 아래 상단 정렬 — 정사각에서 행이
            // 적은 날(주말) 위아래 공백으로 붕 뜨는 것 방지. 온도·지도만 중앙 배치.
            justifyContent:
              kind === "temp" || kind === "recovery" || kind === "trade" ? "center" : "flex-start",
            margin: "24px 112px 0",
          }}
        >
          {/* satori는 Fragment를 못 그린다 — 조건 블록을 나열. */}

          {/* 온도 카드 — 오늘 크게 + 국면 비교 칩 + 추이 차트(SVG data URI, 글자 없음) */}
          {story && (
            <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline" }}>
                <div style={{ display: "flex", color: INK, fontSize: 60, fontFamily: SANS }}>
                  오늘 직전 거래보다 높게&nbsp;
                </div>
                <div style={{ display: "flex", color: UP, fontSize: 112, fontFamily: SANS_B, lineHeight: 1 }}>
                  {`${Math.round(story.todayPct)}%`}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", marginTop: 28, fontSize: 42 }}>
                {story.boomAvg !== null && (
                  <div style={{ display: "flex", flexDirection: "row", marginRight: 44, alignItems: "baseline" }}>
                    <div style={{ display: "flex", color: INK_SOFT }}>{"폭등기('20.11~'21.10) 평균 "}</div>
                    <div style={{ display: "flex", color: UP, fontFamily: SANS_SB }}>{`${Math.round(story.boomAvg)}%`}</div>
                  </div>
                )}
                {story.slumpAvg !== null && (
                  <div style={{ display: "flex", flexDirection: "row", marginRight: 44, alignItems: "baseline" }}>
                    <div style={{ display: "flex", color: INK_SOFT }}>{"급락기('22) 평균 "}</div>
                    <div style={{ display: "flex", color: DOWN, fontFamily: SANS_SB }}>{`${Math.round(story.slumpAvg)}%`}</div>
                  </div>
                )}
                {story.min && (
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline" }}>
                    <div style={{ display: "flex", color: INK_SOFT }}>{`최저(${ymApos(story.min.ym)}) `}</div>
                    <div style={{ display: "flex", color: DOWN, fontFamily: SANS_SB }}>{`${Math.round(story.min.pct)}%`}</div>
                  </div>
                )}
              </div>
              {chartUri && (
                <img src={chartUri} width={CHART_W} height={CHART_H} style={{ marginTop: 30 }} />
              )}
            </div>
          )}

          {/* 지도 카드(회복률·거래) — 절대배치 타일 격자 + 우측 범례·콜아웃 */}
          {shareMap && (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", width: "100%" }}>
              <div style={{ display: "flex", position: "relative", width: mapW, height: mapH }}>
                {shareMap.tiles.map((t) => (
                  <div
                    key={t.sigungu}
                    style={{
                      display: "flex",
                      position: "absolute",
                      left: (t.col - 1) * CELL,
                      top: (t.row - 1) * CELL,
                      width: CELL - 3,
                      height: CELL - 3,
                      alignItems: "center",
                      justifyContent: "center",
                      background: t.fill,
                      color: t.text,
                      border: `1px solid ${TILE_BORDER}`,
                      fontSize: 17,
                      fontFamily: SANS_B,
                      overflow: "hidden",
                    }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 96, justifyContent: "center" }}>
                <div style={{ display: "flex", color: INK, fontSize: 64, fontFamily: SERIF, lineHeight: 1.2 }}>
                  {kind === "recovery" ? "전고점 대비 회복률" : "오늘 공개된 실거래"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
                  {shareMap.legend.map((l) => (
                    <div key={l.label} style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                      <div style={{ display: "flex", width: 44, height: 44, background: l.bg, border: `1px solid ${TILE_BORDER}` }} />
                      <div style={{ display: "flex", color: INK_SOFT, fontSize: 40, fontFamily: SANS, marginLeft: 20 }}>{l.label}</div>
                    </div>
                  ))}
                </div>
                {shareMap.callouts.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
                    <div style={{ display: "flex", color: INK_SOFT, fontSize: 36, fontFamily: SANS_B, marginBottom: 12 }}>
                      {kind === "recovery" ? "회복 최상위" : "가장 활발"}
                    </div>
                    {shareMap.callouts.map((c) => (
                      <div key={c.sigungu} style={{ display: "flex", flexDirection: "row", alignItems: "baseline", marginBottom: 10, width: 520 }}>
                        <div style={{ display: "flex", flex: 1, color: INK, fontSize: 46, fontFamily: SANS_B }}>{c.sigungu}</div>
                        <div style={{ display: "flex", color: kind === "recovery" ? UP : INK, fontSize: 46, fontFamily: SANS_SB }}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {hasRows &&
            kind === "major" &&
            majorAll.slice(0, rowCount).map((d, i) => {
              const pt = pctText(d.pctVsPrev);
              const pc =
                d.pctVsPrev == null || d.pctVsPrev === 0
                  ? INK_SOFT
                  : d.pctVsPrev > 0
                    ? UP
                    : DOWN;
              return (
                <div
                  key={`${d.apt}-${d.priceKrw}-${i}`}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    padding: "9px 0",
                    ...(i < rowCount - 1 ? { borderBottom: "3px solid #e7e1d2" } : {}),
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "baseline",
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div style={{ display: "flex", color: INK, fontSize: 50, fontFamily: SERIF }}>
                      {`${d.dong} ${aptDisplayName(d.apt)}`}
                    </div>
                    {/* (구) 병기 — 1면·착지와 행 문법 통일(2026-07-14). */}
                    <div style={{ display: "flex", color: INK_SOFT, fontSize: 34, fontFamily: SANS, marginLeft: 14 }}>
                      {`(${d.sigungu})`}
                    </div>
                    <div style={{ display: "flex", color: INK_SOFT, fontSize: 34, fontFamily: SANS, marginLeft: 20 }}>
                      {`${areaMeta(d.areaM2)}${d.floor != null ? ` · ${d.floor}층` : ""}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", color: INK, fontSize: 56, fontFamily: SANS_SB, marginLeft: 32 }}>
                    {eok(d.priceKrw)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      width: 260,
                      justifyContent: "flex-end",
                      color: pc,
                      fontSize: 52,
                      fontFamily: SANS_SB,
                    }}
                  >
                    {pt ?? " "}
                  </div>
                </div>
              );
            })}

          {hasRows &&
            kind === "strong" &&
            strongAll.slice(0, rowCount).map((d, i) => (
              <div
                key={`${d.apt}-${d.priceKrw}-${i}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "14px 0",
                  ...(i < rowCount - 1 ? { borderBottom: "4px solid #e7e1d2" } : {}),
                }}
              >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "baseline",
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div style={{ display: "flex", color: INK, fontSize: 56, fontFamily: SERIF }}>
                      {`${d.dong} ${aptDisplayName(d.apt)}`}
                    </div>
                    {/* (구) 병기 — 1면·착지와 행 문법 통일(2026-07-14). */}
                    <div style={{ display: "flex", color: INK_SOFT, fontSize: 38, fontFamily: SANS, marginLeft: 14 }}>
                      {`(${d.sigungu})`}
                    </div>
                    <div style={{ display: "flex", color: INK_SOFT, fontSize: 38, fontFamily: SANS, marginLeft: 24 }}>
                      {`${areaMeta(d.areaM2)}${d.floor != null ? ` · ${d.floor}층` : ""}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", color: INK, fontSize: 60, fontFamily: SANS_SB, marginLeft: 32 }}>
                    {eok(d.priceKrw)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      width: 220,
                      justifyContent: "flex-end",
                      color: UP,
                      fontSize: 52,
                      fontFamily: SANS_SB,
                    }}
                  >
                    {`+${pctAbs(d.pctVsPrev ?? 0)}%`}
                  </div>
                </div>
                <div style={{ display: "flex", color: INK_SOFT, fontSize: 38, fontFamily: SANS, marginTop: 6 }}>
                  {`직전 ${ymdShort(d.prevDate ?? "")} ${d.prevKrw != null ? eok(d.prevKrw) : ""}${d.prevFloor != null ? ` (${d.prevFloor}층)` : ""}`}
                </div>
              </div>
            ))}

          {hasRows &&
            kind === "weak" &&
            weakAll.slice(0, rowCount).map((r, i) => (
              <div
                key={r.sigungu}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  padding: "26px 0",
                  ...(i < rowCount - 1 ? { borderBottom: "4px solid #e7e1d2" } : {}),
                }}
              >
                <div style={{ display: "flex", flex: 1, color: INK, fontSize: 72, fontFamily: SERIF }}>
                  {r.sigungu}
                </div>
                <div style={{ display: "flex", color: DOWN, fontSize: 60, fontFamily: SANS_SB }}>
                  {`직전 대비 평균 −${pctAbs(r.avgPct)}%`}
                </div>
                <div
                  style={{
                    display: "flex",
                    width: 220,
                    justifyContent: "flex-end",
                    color: INK_SOFT,
                    fontSize: 48,
                    fontFamily: SANS,
                    marginLeft: 32,
                  }}
                >
                  {`${r.count}건`}
                </div>
              </div>
            ))}

          {!shareMap && !hasRows && (
            <div style={{ display: "flex", color: INK, fontSize: 108, fontFamily: SERIF, lineHeight: 1.25 }}>
              {emptyText}
            </div>
          )}
        </div>

        {/* 각주 한 줄 */}
        <div style={{ display: "flex", margin: "0 112px 20px", fontSize: 42, color: INK_SOFT, fontFamily: SANS }}>
          {footnote}
        </div>

        {/* 하단 출처 줄 — 자료 문법(2026-07-13 사장 "공유하면 광고 같다"): 슬로건·코랄
            밴드 폐지, 보도자료/리포트처럼 출처 각주만. 브랜드 키는 "정리 {도메인}"으로 절제. */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            margin: "0 112px",
            borderTop: `6px solid ${INK}`,
            padding: "26px 0 40px",
            color: INK_SOFT,
            fontSize: 44,
            fontFamily: SANS,
          }}
        >
          <div style={{ display: "flex" }}>자료: 국토교통부 실거래가 공개시스템</div>
          <div style={{ display: "flex" }}>{`정리 ${SITE_DOMAIN}`}</div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [
        { name: "Nanum", data: nanum, style: "normal", weight: 400 },
        { name: "PretendardSB", data: preSB, style: "normal", weight: 600 },
        { name: "Pretendard", data: preR, style: "normal", weight: 400 },
        { name: "PretendardB", data: preB, style: "normal", weight: 700 },
      ],
    },
  );
}
