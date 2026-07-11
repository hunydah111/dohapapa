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

// 2x 렌더(2400×1260, 비율 og 표준 1200×630) — 고해상도 화면 뭉개짐 방지(동네판 카드와 동일).
const SIZE = { width: 2400, height: 1260 };

const PAPER = "#fbfaf6";
const INK = "#191713";
const INK_SOFT = "#5d574c";
const CORAL = "#e8571f";
const UP = "#c9252d";
const DOWN = "#2563a8";

type Kind = "major" | "strong" | "weak" | "recovery" | "trade";
const KINDS: Kind[] = ["major", "strong", "weak", "recovery", "trade"];
const MAP_KINDS = ["recovery", "trade"] as const;
function isMapKind(k: Kind): k is MapKind {
  return (MAP_KINDS as readonly string[]).includes(k);
}

interface PatchLike {
  generatedAt: string | null;
  major?: MajorItem[];
  nerf?: PatchItem[];
  weakRegions?: RegionPulse[];
}
const patch = dailyPatchRaw as unknown as PatchLike;

const dateSlug = (patch.generatedAt ?? "pre").slice(0, 10);
// 캐시 무효화 — v1→v2(하이브리드)→v3(major 상위 7행)→v4(회복률·거래 지도 카드 추가).
const OG_ID = `v4-${dateSlug}`;

// 카드별 표 행수 상한 — 하단 코랄 밴드 안 침범하는 선. major 카드는 "상위 7개" 고정
// (사장 2026-07-11: 31개 전부는 과함, TOP 7만). 분석 밴드가 1줄이라 7행도 들어간다.
const MAJOR_ROWS = 7;
const MAJOR_ROWS_WITH_AGG = 7;
const STRONG_ROWS = 6;
const WEAK_ROWS = 3;

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
  const CELL = 48; // 타일 한 칸(px, 2x 캔버스)
  const mapW = MAP_COLS * CELL;
  const mapH = MAP_ROWS * CELL;

  const majorCap = majorAgg.length > 0 ? MAJOR_ROWS_WITH_AGG : MAJOR_ROWS;
  const rowCount =
    kind === "major"
      ? Math.min(majorCap, majorAll.length)
      : kind === "strong"
        ? Math.min(STRONG_ROWS, strongAll.length)
        : Math.min(WEAK_ROWS, weakAll.length);
  const totalCount =
    kind === "major" ? majorAll.length : kind === "strong" ? strongAll.length : weakAll.length;
  const restCount = Math.max(0, totalCount - rowCount);
  const hasRows = rowCount > 0;

  const emptyText =
    kind === "major"
      ? "오늘 공개된 큰 거래 없음"
      : kind === "strong"
        ? "오늘 강세 거래 없음"
        : "오늘 약세 동네 없음";

  const footnote = shareMap
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
                오늘 최고 상승 · 직전 대비
              </div>
              {majorAgg.map((r) => (
                <div
                  key={r.sigungu}
                  style={{ display: "flex", flexDirection: "row", alignItems: "baseline", marginRight: 24 }}
                >
                  <div style={{ display: "flex", color: UP, fontFamily: SANS_SB }}>
                    {`${shortRegion(r.sigungu)} +${pctAbs(r.topPct)}%`}
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
            // 분석 밴드가 있는 major는 위로 넘쳐 밴드와 겹치지 않게 상단 정렬, 그 외 중앙.
            justifyContent: majorAgg.length > 0 ? "flex-start" : "center",
            margin: "24px 112px 0",
          }}
        >
          {/* satori는 Fragment를 못 그린다 — 조건 블록을 나열. */}

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
                      {`${d.dong} ${d.apt}`}
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
                      {`${d.dong} ${d.apt}`}
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

        {/* 하단 코랄 밴드 — 얇게(138) + 굵게·크게(Pretendard Bold), mock-hybrid 미러. */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            background: CORAL,
            padding: "0 112px",
            height: 138,
            color: PAPER,
          }}
        >
          <div style={{ display: "flex", fontSize: 52, fontFamily: SANS_B }}>수도권 실거래, 매일 아침 브리핑</div>
          <div style={{ display: "flex", fontSize: 60, fontFamily: SANS_B }}>{SITE_DOMAIN}</div>
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
