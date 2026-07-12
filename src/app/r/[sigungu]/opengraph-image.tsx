import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_DOMAIN } from "@/lib/site";
import { SIGUNGU_NAMES } from "@/lib/molit";
import dailyPatchRaw from "@/data/dailyPatch.json";
import dailyRecentRaw from "@/data/dailyRecent.json";
import { type MajorItem, type PatchTemp } from "@/lib/patchNote";
import { areaMeta } from "@/lib/areaLabel";
import { aptDisplayName } from "@/lib/aptName";

// 동네면 링크 썸네일 — "그 동네 오늘 팩트 카드" (2026-07-08, 뿌리기 앰프).
// 커뮤니티·단톡에 /r/{동네} 링크를 던지면 카드가 그날 숫자(공개 N건·온도·최고 거래)를
// 보여준다 — 퍼나르는 단위가 곧 지면. 크론 재배포로 매일 갱신, 날짜 박은 URL로 캐시 우회.
// 프리미엄 하이브리드(2026-07-11 mock-hybrid 검증): 세리프(나눔명조)={동네}판·단지명 ·
//   Pretendard=본문·숫자(가격/%=SemiBold)·비집고 워드마크(Bold) · 코랄 밴드 얇게+굵게.
export const contentType = "image/png";

// 2x 렌더(2400×1260, 비율은 og 표준 1200×630 유지) — 1x는 고해상도 화면·확대에서
// 뭉개진다(2026-07-10 사장 제보). 아래 스타일 수치는 전부 2배 기준.
const SIZE = { width: 2400, height: 1260 };

const PAPER = "#fbfaf6";
const INK = "#191713";
const INK_SOFT = "#5d574c";
const CORAL = "#e8571f";
const UP = "#c9252d";
const DOWN = "#2563a8";

interface PatchLike {
  generatedAt: string | null;
  latestDealDate: string | null;
  major?: MajorItem[];
  regionCounts?: Record<string, number>;
  regionTemp?: Record<string, PatchTemp>;
}
const patch = dailyPatchRaw as unknown as PatchLike;

// 오늘 공개 거래 목록 — 카드의 본문(2026-07-10 사장 지적: 건수 한 줄로는 아무 정보도
// 없다). dailyRecent 3일 롤링의 마지막 날 = 오늘 발행분, pctVsPrev(직전 대비) 동봉.
interface RecentItem {
  apartmentName: string;
  priceKrw: number;
  area: number;
  sigunguName: string;
  dongName: string;
  floor?: number | null;
  dealingGbn?: string;
  canceled?: boolean;
  pctVsPrev?: number | null;
}
const recentDays = (dailyRecentRaw as unknown as { days: { date: string; items: RecentItem[] }[] })
  .days;
const todayItems: RecentItem[] =
  recentDays.length > 0 ? recentDays[recentDays.length - 1].items : [];

const CARD_ROWS = 4; // 표 행 수 — 1200×630에서 하단 밴드 안 침범하는 상한

const dateSlug = (patch.generatedAt ?? "pre").slice(0, 10);
// 디자인 개정(프리미엄 하이브리드)으로 캐시 무효화 — v1→v2.
const OG_ID = `v2-${dateSlug}`;

export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ sigungu: string }>;
}) {
  const { sigungu } = await params;
  return [
    {
      id: OG_ID,
      alt: `${decodeSigungu(sigungu) ?? "동네"}판 — 오늘 공개 실거래 · 비집고`,
      size: SIZE,
      contentType,
    },
  ];
}

function decodeSigungu(raw: string): string | null {
  try {
    const d = decodeURIComponent(raw);
    return SIGUNGU_NAMES.has(d) ? d : null;
  } catch {
    return null;
  }
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

export default async function Image({
  params,
}: {
  params: Promise<{ sigungu: string }>;
}) {
  // 프리미엄 하이브리드 폰트(mock-hybrid 미러): 나눔명조 Regular + Pretendard 3종.
  const [nanum, preSB, preR, preB] = await Promise.all([
    readFile(join(process.cwd(), "assets/NanumMyeongjo-Regular.ttf")),
    readFile(join(process.cwd(), "assets/Pretendard-SemiBold.otf")),
    readFile(join(process.cwd(), "assets/Pretendard-Regular.otf")),
    readFile(join(process.cwd(), "assets/Pretendard-Bold.otf")),
  ]);
  const SERIF = "Nanum";
  const SANS = "Pretendard";
  const SANS_SB = "PretendardSB";
  const SANS_B = "PretendardB";
  const { sigungu: rawSigungu } = await params;
  const sigungu = decodeSigungu(rawSigungu);
  const count = sigungu ? (patch.regionCounts?.[sigungu] ?? 0) : 0;
  // 카드 본문 = 오늘 이 동네 거래 표 — 해제 제외, 가격 내림차순 상위 CARD_ROWS.
  const deals = sigungu
    ? todayItems
        .filter((d) => d.sigunguName === sigungu && !d.canceled)
        .sort((a, b) => b.priceKrw - a.priceKrw)
    : [];
  const rows = deals.slice(0, CARD_ROWS);
  const restCount = Math.max(0, deals.length - rows.length);

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
            margin: "68px 112px 0",
            paddingBottom: 28,
            borderBottom: `10px solid ${INK}`,
            color: INK_SOFT,
            fontSize: 60,
          }}
        >
          <div style={{ display: "flex" }}>{koDateShort(patch.generatedAt)}</div>
          <div style={{ display: "flex" }}>매일 아침 발행 · 국토부 공개분</div>
        </div>

        {/* 제호(소) + 동네판 이름 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            margin: "56px 112px 0",
            gap: 44,
          }}
        >
          <div
            style={{
              display: "flex",
              background: CORAL,
              color: PAPER,
              fontSize: 84,
              fontFamily: SANS_B,
              lineHeight: 1,
              padding: "18px 34px 24px",
            }}
          >
            비집고
          </div>
          <div style={{ display: "flex", color: INK, fontSize: 112, fontFamily: SERIF, lineHeight: 1 }}>
            {sigungu ? `${sigungu}판` : "동네판"}
          </div>
          <div
            style={{
              display: "flex",
              flex: 1,
              justifyContent: "flex-end",
              color: INK_SOFT,
              fontSize: 64,
              fontFamily: SANS,
            }}
          >
            오늘 공개 {count.toLocaleString("ko-KR")}건
          </div>
        </div>

        {/* 본문 — 오늘 거래 표 (가격 내림차순 상위 5). 단지·평형·층 | 가격 | 직전 대비 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: rows.length > 0 ? "flex-start" : "center",
            margin: "36px 112px 0",
          }}
        >
          {/* satori는 React Fragment를 못 그린다 — 조건 블록을 fragment 없이 나열. */}
          {rows.length > 0 &&
            rows.map((d, i) => {
                const pct = d.pctVsPrev;
                const pctText =
                  pct == null
                    ? null
                    : `${pct > 0 ? "+" : ""}${Math.round(pct * 1000) / 10}%`;
                const pctColor = pct == null || pct === 0 ? INK_SOFT : pct > 0 ? UP : DOWN;
                return (
                  <div
                    key={`${d.apartmentName}-${d.priceKrw}-${i}`}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      padding: "20px 0",
                      // satori는 undefined 스타일 값에서 죽는다(trim) — 조건부 스프레드만 허용.
                      ...(i < rows.length - 1 ? { borderBottom: "4px solid #e7e1d2" } : {}),
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
                      <div style={{ display: "flex", color: INK, fontSize: 72, fontFamily: SERIF }}>
                        {`${d.dongName} ${aptDisplayName(d.apartmentName)}`}
                      </div>
                      {/* Pretendard는 ㎡·평 글리프 있음 → areaMeta("84.7㎡ · 32~35평") 그대로. */}
                      <div style={{ display: "flex", color: INK_SOFT, fontSize: 48, fontFamily: SANS, marginLeft: 28 }}>
                        {`${areaMeta(d.area)}${d.floor != null ? ` · ${d.floor}층` : ""}${d.dealingGbn === "직거래" ? " · 직거래" : ""}`}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        color: INK,
                        fontSize: 80,
                        fontFamily: SANS_SB,
                        marginLeft: 40,
                      }}
                    >
                      {eok(d.priceKrw)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        width: 300,
                        justifyContent: "flex-end",
                        color: pctColor,
                        fontSize: 60,
                        fontFamily: SANS_SB,
                      }}
                    >
                      {pctText ?? " "}
                    </div>
                  </div>
                );
              })}
          {rows.length > 0 && (
            <div
              style={{
                display: "flex",
                marginTop: 24,
                fontSize: 46,
                color: INK_SOFT,
                fontFamily: SANS,
              }}
            >
              {`${restCount > 0 ? `외 ${restCount}건 · ` : ""}% = 같은 단지 직전 실거래 대비 · 12개월 추이는 지면에서`}
            </div>
          )}
          {rows.length === 0 && (
            <div style={{ display: "flex", color: INK, fontSize: 120, fontFamily: SERIF, lineHeight: 1.25 }}>
              오늘 새로 공개된 거래 없음
            </div>
          )}
          {rows.length === 0 && (
            <div style={{ display: "flex", marginTop: 40, fontSize: 60, color: INK_SOFT, fontFamily: SANS }}>
              12개월 추이·최근 거래 상위는 지면에서
            </div>
          )}
        </div>

        {/* 하단 코랄 밴드 — 얇게 + 굵게·크게(Pretendard Bold), mock-hybrid 미러. */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            background: CORAL,
            padding: "0 112px",
            height: 150,
            color: PAPER,
          }}
        >
          <div style={{ display: "flex", fontSize: 56, fontFamily: SANS_B }}>우리 동네 실거래, 매일 아침 브리핑</div>
          <div style={{ display: "flex", fontSize: 62, fontFamily: SANS_B }}>{SITE_DOMAIN}</div>
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
