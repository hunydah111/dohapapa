import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getHomeTypeBySlug, HOME_TYPE_SLUGS } from "@/lib/homeType";

// 유형별 공유 카드(1200×630) — "나의 집 찾기 유형: ○○형" + 유형 비지. MBTI식 바이럴 후킹.
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
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          padding: "0 70px",
          background: "linear-gradient(135deg, #ff7a59 0%, #7c3aed 100%)",
          fontFamily: "BlackHanSans",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beaver} width={420} height={420} style={{ objectFit: "contain" }} alt="" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ fontSize: 40, color: "rgba(255,255,255,0.85)" }}>나의 집 찾기 유형</div>
          <div style={{ fontSize: 116, lineHeight: 1.05, marginTop: 8, color: "#ffffff" }}>
            {ht.name}
          </div>
          <div style={{ fontSize: 38, marginTop: 22, color: "rgba(255,255,255,0.92)" }}>
            {ht.tagline}
          </div>
          <div style={{ fontSize: 30, marginTop: 44, color: "rgba(255,255,255,0.8)" }}>
            나도 찾아보기 · 비집고 homenasia.kr
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "BlackHanSans", data: font, style: "normal", weight: 400 }],
    },
  );
}
