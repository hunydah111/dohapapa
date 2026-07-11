import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_DOMAIN } from "@/lib/site";
import dailyPatchRaw from "@/data/dailyPatch.json";
import { type MajorItem } from "@/lib/patchNote";

// [오늘의 주요 거래 TOP 7] 공유 카드 — 1면 [주요 거래] 코너를 그대로 담은 공유 자산
// (2026-07-11 사장 지시). 매번 캡쳐·짤린 크롭 대신, 원탭으로 퍼나르는 깔끔한 카드.
// 편집·해석 0 — 그냥 오늘 큰 거래를 가격순으로 인쇄한 "중립 문서"다. "강남 오르고 송파
// 내린다" 같은 해석은 퍼나르는 사람의 댓글 몫(무조작 헌장 — 앱은 팩트만, 선은 사람이).
// 카드 문법은 동네판 카드(r/[sigungu]/opengraph-image)와 동일 — 제호·표·코랄 밴드.
export const contentType = "image/png";

// 2x 렌더(2400×1260, 비율 og 표준 1200×630) — 고해상도 화면 뭉개짐 방지(동네판 카드와 동일).
const SIZE = { width: 2400, height: 1260 };

const PAPER = "#fbfaf6";
const INK = "#191713";
const INK_SOFT = "#5d574c";
const CORAL = "#e8571f";
const UP = "#c9252d";
const DOWN = "#2563a8";

interface PatchLike {
  generatedAt: string | null;
  major?: MajorItem[];
}
const patch = dailyPatchRaw as unknown as PatchLike;

const CARD_ROWS = 7; // 사장 지시 — 상위 7건.

const dateSlug = (patch.generatedAt ?? "pre").slice(0, 10);
const OG_ID = `v1-${dateSlug}`;

export function generateImageMetadata() {
  return [
    {
      id: OG_ID,
      alt: "오늘의 주요 거래 — 수도권 큰 실거래 TOP 7 · 비집고",
      size: SIZE,
      contentType,
    },
  ];
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

export default async function Image() {
  const font = await readFile(
    join(process.cwd(), "assets/BlackHanSans-Regular.ttf"),
  );
  // major는 가격 내림차순 정렬 상태(DailyFront와 동일 계약) — 상위 CARD_ROWS.
  const all = patch.major ?? [];
  const rows = all.slice(0, CARD_ROWS);
  const restCount = Math.max(0, all.length - rows.length);

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
            margin: "56px 112px 0",
            paddingBottom: 24,
            borderBottom: `10px solid ${INK}`,
            color: INK_SOFT,
            fontSize: 54,
          }}
        >
          <div style={{ display: "flex" }}>{koDateShort(patch.generatedAt)}</div>
          <div style={{ display: "flex" }}>매일 아침 발행 · 국토부 공개분</div>
        </div>

        {/* 제호(소) + 코너명 + 건수 */}
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
              fontSize: 76,
              lineHeight: 1,
              padding: "18px 32px 24px",
            }}
          >
            비집고
          </div>
          <div style={{ display: "flex", color: INK, fontSize: 92, lineHeight: 1 }}>
            오늘의 주요 거래
          </div>
          <div
            style={{
              display: "flex",
              flex: 1,
              justifyContent: "flex-end",
              color: INK_SOFT,
              fontSize: 52,
            }}
          >
            수도권 15억 이상 · 가격순
          </div>
        </div>

        {/* 본문 — 상위 7건 표. 동+단지 · 면적·층 | 가격 | 직전 대비 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: rows.length > 0 ? "center" : "center",
            margin: "24px 112px 0",
          }}
        >
          {rows.length > 0 &&
            rows.map((d, i) => {
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
                    padding: "18px 0",
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
                    <div style={{ display: "flex", color: INK, fontSize: 60 }}>
                      {`${d.dong} ${d.apt}`}
                    </div>
                    {/* ㎡(U+33A1)는 BlackHanSans 글리프 없음(tofu) — 라틴 m²로. */}
                    <div style={{ display: "flex", color: INK_SOFT, fontSize: 44, marginLeft: 24 }}>
                      {`${Math.round(d.areaM2)}m²${d.floor != null ? ` · ${d.floor}층` : ""}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", color: INK, fontSize: 68, marginLeft: 36 }}>
                    {eok(d.priceKrw)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      width: 260,
                      justifyContent: "flex-end",
                      color: pc,
                      fontSize: 52,
                    }}
                  >
                    {pt ?? " "}
                  </div>
                </div>
              );
            })}
          {rows.length === 0 && (
            <div style={{ display: "flex", color: INK, fontSize: 112, lineHeight: 1.25 }}>
              오늘 공개된 큰 거래 없음
            </div>
          )}
        </div>

        {/* 각주 한 줄 */}
        <div style={{ display: "flex", margin: "0 112px 20px", fontSize: 44, color: INK_SOFT }}>
          {`${restCount > 0 ? `외 ${restCount}건 · ` : ""}% = 같은 단지 직전 실거래 대비 · 전체는 지면에서`}
        </div>

        {/* 하단 코랄 밴드 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            background: CORAL,
            padding: "0 112px",
            height: 200,
            color: PAPER,
            fontSize: 64,
          }}
        >
          <div style={{ display: "flex" }}>수도권 실거래, 매일 아침 브리핑</div>
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
