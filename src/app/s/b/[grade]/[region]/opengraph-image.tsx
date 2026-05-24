import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getTierBySlug, BEAVER_TIERS } from "@/lib/budgetPercentile";
import { isKnownSigungu } from "@/lib/molit";

// 비버 등급 공유카드(1200×630) — "나는 ○○비버 · 내 예산이면 △△구까지". PII 없음(등급+시군구만).
// 메인 OG와 동일한 따뜻한 코랄 톤. 이모지는 Satori 미지원이라 비버 이미지로 대체(텍스트엔 이모지 X).
export const alt = "내 비버 등급 — 비집고";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 432조합(6등급×72시군구)이라 정적 생성하지 않고 런타임 렌더(동적 OG).
export default async function Image({
  params,
}: {
  params: Promise<{ grade: string; region: string }>;
}) {
  const { grade, region: rawRegion } = await params;
  const tier = getTierBySlug(grade) ?? BEAVER_TIERS.gukmin;

  let region = "수도권";
  try {
    const decoded = decodeURIComponent(rawRegion);
    if (isKnownSigungu(decoded)) region = decoded;
  } catch {
    /* 잘못된 인코딩 — 기본 '수도권' 유지 */
  }

  const font = await readFile(join(process.cwd(), "assets/BlackHanSans-Regular.ttf"));
  const beaverBuf = await readFile(
    join(process.cwd(), "public", tier.image.replace(/^\//, "")),
  );
  const beaver = `data:image/png;base64,${beaverBuf.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#f5ecd9",
          fontFamily: "BlackHanSans",
        }}
      >
        {/* 상단: 등급 비버 + 등급·동네 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
            padding: "0 64px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beaver} width={360} height={360} style={{ objectFit: "contain" }} alt="" />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 40 }}>
            <div style={{ fontSize: 36, color: "#6b6157" }}>내 비버 등급</div>
            <div style={{ fontSize: 110, lineHeight: 1.05, marginTop: 4, color: "#e8662f" }}>
              {tier.label}
            </div>
            <div style={{ fontSize: 40, marginTop: 16, color: "#3a322c" }}>
              {`내 예산이면 ${region}까지 닿아요`}
            </div>
            <div style={{ fontSize: 30, marginTop: 12, color: "#8a8076" }}>
              {`“${tier.drip}”`}
            </div>
          </div>
        </div>

        {/* 하단 코랄 밴드 — 흰글자 워드마크 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#e8662f",
            padding: "0 64px",
            height: 140,
          }}
        >
          <div style={{ fontSize: 80, color: "#fffdf8", lineHeight: 1 }}>비집고</div>
          <div style={{ fontSize: 32, color: "#ffe6dc" }}>나도 찾아보기 · homenasia.kr</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "BlackHanSans", data: font, style: "normal", weight: 400 }],
    },
  );
}
