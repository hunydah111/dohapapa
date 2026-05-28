import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getTierBySlug, BEAVER_TIERS, pickTierImage } from "@/lib/budgetPercentile";
import { composeBijiName } from "@/lib/bijiName";
import { isKnownSigungu, normalizeSigungu } from "@/lib/molit";
import { SITE_DOMAIN } from "@/lib/site";

// 비버 등급 공유카드(1200×630) — 등급별 테마 통째.
// 좌측 = 등급 비지 일러스트, 우측 = 합성 이름(예 "광피버") + 동네 + 드립 + 워드마크.
// 등급별 cardBg 그라데를 OG 배경에 통째 적용 — 같은 시리즈인데 6장 다 다른 무드.
// Satori 이모지 미지원 → 텍스트엔 이모지 X(비지 그림이 그 역할).
export const alt = "내 비버 등급 — 비집고";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
    if (isKnownSigungu(decoded)) region = normalizeSigungu(decoded);
  } catch {
    /* 잘못된 인코딩 — '수도권' 폴백 */
  }

  const font = await readFile(join(process.cwd(), "assets/BlackHanSans-Regular.ttf"));
  // tier.image가 array면 region 시드로 결정적 픽 — 같은 공유 URL은 항상 같은 비지.
  const tierImagePath = pickTierImage(tier.image, region === "수도권" ? null : region);
  const beaverBuf = await readFile(
    join(process.cwd(), "public", tierImagePath.replace(/^\//, "")),
  );
  const beaver = `data:image/png;base64,${beaverBuf.toString("base64")}`;

  const name = composeBijiName(region === "수도권" ? null : region, tier);
  const light = tier.theme.textTone === "light";
  const primary = light ? "#ffffff" : "#3a2c1d";
  const secondary = light ? "rgba(255,255,255,0.82)" : "#6e5b46";
  const muted = light ? "rgba(255,255,255,0.6)" : "#9c8a72";
  const wordmark = light ? "#ffffff" : tier.theme.accent;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: tier.theme.cardBg,
          fontFamily: "BlackHanSans",
        }}
      >
        {/* 좌측: 등급 비지 — bottom 정렬, 큰 그림자로 배경 대비 보강 */}
        <div
          style={{
            display: "flex",
            width: "48%",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 40,
            paddingLeft: 30,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beaver}
            width={460}
            height={460}
            style={{
              objectFit: "contain",
              filter: "drop-shadow(0 10px 26px rgba(0,0,0,0.28))",
            }}
            alt=""
          />
        </div>

        {/* 우측: 합성 이름 + 동네 + 드립 + 워드마크 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "52%",
            padding: "70px 64px 60px 0",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 34, color: secondary }}>내 비버 등급</div>
          <div
            style={{
              fontSize: name.length >= 5 ? 110 : 138,
              lineHeight: 1.02,
              marginTop: 8,
              color: primary,
            }}
          >
            {name}
          </div>
          <div style={{ fontSize: 38, marginTop: 22, color: primary }}>
            {`내 통장으로 ${region}까지`}
          </div>
          <div style={{ fontSize: 28, marginTop: 14, color: muted }}>
            {`"${tier.drip}"`}
          </div>

          {/* 워드마크 영역 */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
              marginTop: 44,
            }}
          >
            <div style={{ fontSize: 62, color: wordmark, lineHeight: 1 }}>비집고</div>
            <div style={{ fontSize: 24, color: muted, marginLeft: 18, marginBottom: 6 }}>
              {`너는 무슨 비버? · ${SITE_DOMAIN}`}
            </div>
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
