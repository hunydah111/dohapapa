import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_DOMAIN } from "@/lib/site";
import { SIGUNGU_NAMES } from "@/lib/molit";
import dailyPatchRaw from "@/data/dailyPatch.json";
import dailyRecentRaw from "@/data/dailyRecent.json";
import { type MajorItem, type PatchTemp } from "@/lib/patchNote";

// 동네면 링크 썸네일 — "그 동네 오늘 팩트 카드" (2026-07-08, 뿌리기 앰프).
// 커뮤니티·단톡에 /r/{동네} 링크를 던지면 카드가 그날 숫자(공개 N건·온도·최고 거래)를
// 보여준다 — 퍼나르는 단위가 곧 지면. 크론 재배포로 매일 갱신, 날짜 박은 URL로 캐시 우회.
export const contentType = "image/png";

const SIZE = { width: 1200, height: 630 };

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
const OG_ID = `v1-${dateSlug}`;

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
  const font = await readFile(
    join(process.cwd(), "assets/BlackHanSans-Regular.ttf"),
  );
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
          fontFamily: "BlackHanSans",
        }}
      >
        {/* 정보띠 + 먹 괘선 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "34px 56px 0",
            paddingBottom: 14,
            borderBottom: `5px solid ${INK}`,
            color: INK_SOFT,
            fontSize: 30,
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
            margin: "28px 56px 0",
            gap: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              background: CORAL,
              color: PAPER,
              fontSize: 46,
              lineHeight: 1,
              padding: "10px 18px 14px",
            }}
          >
            비집고
          </div>
          <div style={{ display: "flex", color: INK, fontSize: 58, lineHeight: 1 }}>
            {sigungu ? `${sigungu}판` : "동네판"}
          </div>
          <div
            style={{
              display: "flex",
              flex: 1,
              justifyContent: "flex-end",
              color: INK_SOFT,
              fontSize: 32,
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
            margin: "18px 56px 0",
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
                      padding: "10px 0",
                      // satori는 undefined 스타일 값에서 죽는다(trim) — 조건부 스프레드만 허용.
                      ...(i < rows.length - 1 ? { borderBottom: "2px solid #e7e1d2" } : {}),
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
                      <div style={{ display: "flex", color: INK, fontSize: 36 }}>
                        {`${d.dongName} ${d.apartmentName}`}
                      </div>
                      {/* ㎡(U+33A1)는 BlackHanSans에 글리프가 없다(tofu) — 라틴 m²로 표기. */}
                      <div style={{ display: "flex", color: INK_SOFT, fontSize: 27, marginLeft: 14 }}>
                        {`${Math.round(d.area)}m²${d.floor != null ? ` · ${d.floor}층` : ""}${d.dealingGbn === "직거래" ? " · 직거래" : ""}`}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        color: INK,
                        fontSize: 40,
                        marginLeft: 20,
                      }}
                    >
                      {eok(d.priceKrw)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        width: 150,
                        justifyContent: "flex-end",
                        color: pctColor,
                        fontSize: 30,
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
                marginTop: 12,
                fontSize: 26,
                color: INK_SOFT,
              }}
            >
              {`${restCount > 0 ? `외 ${restCount}건 · ` : ""}% = 같은 단지 직전 실거래 대비 · 12개월 추이는 지면에서`}
            </div>
          )}
          {rows.length === 0 && (
            <div style={{ display: "flex", color: INK, fontSize: 64, lineHeight: 1.25 }}>
              오늘 새로 공개된 거래 없음
            </div>
          )}
          {rows.length === 0 && (
            <div style={{ display: "flex", marginTop: 20, fontSize: 32, color: INK_SOFT }}>
              12개월 추이·최근 거래 상위는 지면에서
            </div>
          )}
        </div>

        {/* 하단 코랄 밴드 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            background: CORAL,
            padding: "0 56px",
            height: 108,
            color: PAPER,
            fontSize: 34,
          }}
        >
          <div style={{ display: "flex" }}>우리 동네 실거래, 매일 아침 브리핑</div>
          <div style={{ display: "flex" }}>{SITE_DOMAIN}</div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [{ name: "BlackHanSans", data: font, style: "normal", weight: 400 }],
    },
  );
}
