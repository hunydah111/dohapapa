import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getHomeTypeBySlug, HOME_TYPE_SLUGS } from "@/lib/homeType";

// 유형별 공유 카드(1200×630) — "나의 집 찾기 유형: ○○형" + 유형 비지. MBTI식 바이럴 후킹.
// 메인 OG와 동일한 따뜻한 코랄 톤(크림 배경 + 하단 코랄 밴드 흰 워드마크)으로 통일.
export const alt = "내 집 찾기 유형 — 비집고";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return HOME_TYPE_SLUGS.map((type) => ({ type }));
}

export default async function Image({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const ht = getHomeTypeBySlug(type) ?? getHomeTypeBySlug("balanced")!;

  const font = await readFile(join(process.cwd(), "assets/BlackHanSans-Regular.ttf"));
  const beaverBuf = await readFile(
    join(process.cwd(), "public", "biji", `biji-type-${ht.slug}.png`),
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
        {/* 상단: 유형 비지 + 유형명 */}
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
          <img src={beaver} width={372} height={372} style={{ objectFit: "contain" }} alt="" />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 44 }}>
            <div style={{ fontSize: 38, color: "#6b6157" }}>나의 집 찾기 유형</div>
            <div style={{ fontSize: 104, lineHeight: 1.05, marginTop: 6, color: "#e8662f" }}>
              {ht.name}
            </div>
            <div style={{ fontSize: 36, marginTop: 18, color: "#3a322c" }}>{ht.tagline}</div>
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
