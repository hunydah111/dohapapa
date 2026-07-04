import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getTierBySlug, BEAVER_TIERS } from "@/lib/budgetPercentile";
import { composeBijiName } from "@/lib/bijiName";
import { isKnownSigungu, normalizeSigungu } from "@/lib/molit";
import { SITE_DOMAIN } from "@/lib/site";

// 비버 등급 공유카드(1200×630) — 타이포그래피 중심 (2026-07 캐릭터 강등: 일러스트 제거).
// 합성 이름(예 "마포구 퀸비버")을 초대형으로 + 동네 + 드립 + 워드마크.
// 등급별 cardBg 그라데를 OG 배경에 통째 적용 — 같은 시리즈인데 등급마다 다른 무드.
// Satori 이모지 미지원 → 텍스트엔 이모지 X.
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

  const name = composeBijiName(region === "수도권" ? null : region, tier);
  const light = tier.theme.textTone === "light";
  const primary = light ? "#ffffff" : "#3a2c1d";
  const secondary = light ? "rgba(255,255,255,0.82)" : "#6e5b46";
  const muted = light ? "rgba(255,255,255,0.6)" : "#9c8a72";
  const accent = tier.theme.nameColor ?? (light ? "#ffffff" : tier.theme.accent);
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
        {/* 타이포 카드 — 등급 텍스트가 주인공 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: "80px 90px 64px",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 40, color: secondary }}>내 비버 등급</div>
          <div
            style={{
              fontSize: name.length >= 7 ? 130 : 168,
              lineHeight: 1.02,
              marginTop: 12,
              color: accent,
            }}
          >
            {name}
          </div>
          <div style={{ fontSize: 46, marginTop: 30, color: primary }}>
            {`내 통장으로 ${region}까지`}
          </div>
          <div style={{ fontSize: 32, marginTop: 16, color: muted }}>
            {`"${tier.drip}"`}
          </div>

          {/* 워드마크 영역 */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
              marginTop: 56,
            }}
          >
            <div style={{ fontSize: 62, color: wordmark, lineHeight: 1 }}>비집고</div>
            <div style={{ fontSize: 26, color: muted, marginLeft: 18, marginBottom: 6 }}>
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
