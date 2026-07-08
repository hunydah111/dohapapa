import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_DOMAIN } from "@/lib/site";
import { SIGUNGU_NAMES } from "@/lib/molit";
import dailyPatchRaw from "@/data/dailyPatch.json";
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
  const temp = sigungu ? (patch.regionTemp?.[sigungu] ?? null) : null;
  const topDeal =
    sigungu && patch.major ? (patch.major.find((m) => m.sigungu === sigungu) ?? null) : null;
  // 온도 줄 — 전역 지면과 같은 규칙: 표본 5건 미만이면 숫자 인쇄 금지(헌장 ②).
  const tempPct =
    temp && temp.matched >= 5
      ? {
          above: Math.round((temp.above / temp.matched) * 100),
          below: Math.round((temp.below / temp.matched) * 100),
          matched: temp.matched,
        }
      : null;

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
          <div style={{ display: "flex", color: INK, fontSize: 66, lineHeight: 1 }}>
            {sigungu ? `${sigungu}판` : "동네판"}
          </div>
        </div>

        {/* 오늘 팩트 — 공개 건수 크게, 온도·최고 거래 병기 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            margin: "0 56px",
          }}
        >
          {count > 0 ? (
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div style={{ display: "flex", color: INK, fontSize: 96, lineHeight: 1 }}>
                오늘 공개 {count.toLocaleString("ko-KR")}건
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", color: INK, fontSize: 72, lineHeight: 1.25 }}>
              오늘 새로 공개된 거래 없음
            </div>
          )}
          {tempPct && (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                marginTop: 26,
                fontSize: 40,
                color: INK_SOFT,
              }}
            >
              <div style={{ display: "flex" }}>직전 거래보다 높게&nbsp;</div>
              <div style={{ display: "flex", color: UP }}>{tempPct.above}%</div>
              <div style={{ display: "flex" }}>&nbsp;: 낮게&nbsp;</div>
              <div style={{ display: "flex", color: DOWN }}>{tempPct.below}%</div>
              <div style={{ display: "flex", fontSize: 30, alignItems: "flex-end" }}>
                &nbsp;· {tempPct.matched}건 기준
              </div>
            </div>
          )}
          {topDeal && (
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: 38,
                color: INK,
                borderLeft: `8px solid ${CORAL}`,
                paddingLeft: 20,
                lineHeight: 1.3,
              }}
            >
              {`${topDeal.dong} ${topDeal.apt} ${eok(topDeal.priceKrw)}`}
            </div>
          )}
          {!count && !tempPct && (
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
