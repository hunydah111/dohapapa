import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getTierBySlug, BEAVER_TIERS } from "@/lib/budgetPercentile";
import { getReachBySlug, composeReachName } from "@/lib/bijiName";
import { isKnownSigungu, normalizeSigungu } from "@/lib/molit";
import { SITE_DOMAIN } from "@/lib/site";

// 판정 공유카드(1200×630) — 타이포그래피 중심 (2026-07 비버 퇴장: 사정권 라벨).
// 히어로 이름(예 "마포구 사정권")을 초대형으로 + 동네 + 워드마크.
// 레거시 slug는 tier 테마(배경 색)만 유지하고 이름은 중립 "판정" — 비버 등급명 노출 금지.
// Satori 이모지 미지원 → 텍스트엔 이모지 X.
export const alt = "내 판정 — 비집고";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ grade: string; region: string }>;
}) {
  const { grade, region: rawRegion } = await params;
  const reach = getReachBySlug(grade);
  const tier = getTierBySlug(grade) ?? BEAVER_TIERS.gukmin; // 색 테마 전용

  let region = "수도권";
  try {
    const decoded = decodeURIComponent(rawRegion);
    if (isKnownSigungu(decoded)) region = normalizeSigungu(decoded);
  } catch {
    /* 잘못된 인코딩 — '수도권' 폴백 */
  }

  const font = await readFile(join(process.cwd(), "assets/BlackHanSans-Regular.ttf"));

  const name = composeReachName(region === "수도권" ? null : region, reach);
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
        {/* 타이포 카드 — 판정 텍스트가 주인공 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: "80px 90px 64px",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 40, color: secondary }}>내 판정</div>
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
            통장 까면, 동네 나온다
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
              {`너는 어디까지 닿나? · ${SITE_DOMAIN}`}
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
