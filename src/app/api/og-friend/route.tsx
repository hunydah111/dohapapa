// 친구 비교용 OG 이미지 (1200×630) — `?f={slug}.{sigungu}` 받아서 친구 판정 카드 동적 생성.
// 카톡 미리보기에서 "[마포구 사정권] 친구가 판정 까고 던졌다" 텍스트 hook → 클릭 유발.
// 타이포그래피 중심 (2026-07 비버 퇴장) — 사정권 라벨 초대형 + D-day + 워드마크.
// 레거시 slug(queen 등) 링크도 파싱됨 — tier는 배경 색 테마로만, 이름은 라벨/판정.
//
// page.tsx의 generateMetadata에서 openGraph.images로 이 URL을 가리킴. 친구 URL마다 다른
// 라벨/시군구라 변주는 자동. 캐시 키는 ?f= 값 그대로.

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { decodeFriend, friendDdayLabel, friendReachName } from "@/lib/friendShare";
import { BEAVER_TIERS } from "@/lib/budgetPercentile";
import { SITE_DOMAIN } from "@/lib/site";

export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const friendParam = url.searchParams.get("f");
  const tag = decodeFriend(friendParam);
  // 잘못된/없는 ?f= → 폴백: 기본 비집고 브랜드 OG (단순). 깨진 링크에서도 안전.
  // tier는 색 테마 전용 — 새 slug 링크(tier=null)는 중립(gukmin) 테마.
  const tier = tag?.tier ?? BEAVER_TIERS.gukmin;
  const name = tag ? friendReachName(tag)! : "비집고";
  const ddayLabel = friendDdayLabel(tag);

  const font = await readFile(join(process.cwd(), "assets/BlackHanSans-Regular.ttf"));

  const light = tier.theme.textTone === "light";
  const secondary = light ? "rgba(255,255,255,0.85)" : "#6e5b46";
  const primary = light ? "#ffffff" : "#3a2c1d";
  const accent = tier.theme.nameColor ?? (light ? "#ffffff" : tier.theme.accent);

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
        {/* 타이포 카드 — 친구 등급 이름이 주인공 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: "76px 90px 60px",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 38,
              color: secondary,
              marginBottom: 10,
            }}
          >
            친구가 판정 까고 던졌다
          </div>
          <div
            style={{
              fontSize: name.length >= 8 ? 96 : name.length >= 6 ? 118 : 148,
              lineHeight: 1.02,
              marginTop: 4,
              color: accent,
            }}
          >
            {name}
          </div>
          {ddayLabel && (
            <div
              style={{
                fontSize: 76,
                lineHeight: 1.05,
                marginTop: 18,
                color: light ? "#ffe9a8" : "#c4521f",
              }}
            >
              {ddayLabel}
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 38,
              marginTop: 26,
              color: primary,
            }}
          >
            <div>통장 까면 동네 나온다.</div>
            <div>너도 30초 까봐.</div>
          </div>

          {/* 워드마크 */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
              marginTop: 48,
            }}
          >
            <div
              style={{
                fontSize: 56,
                color: light ? "#ffffff" : tier.theme.accent,
                lineHeight: 1,
              }}
            >
              비집고
            </div>
            <div
              style={{
                fontSize: 24,
                color: light ? "rgba(255,255,255,0.7)" : "#9c8a72",
                marginLeft: 18,
                marginBottom: 4,
              }}
            >
              {SITE_DOMAIN}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [{ name: "BlackHanSans", data: font, style: "normal", weight: 400 }],
      // 캐시 — 친구 URL은 한 번 만들면 영원히 같은 등급/카피라 길게 캐싱 가능.
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
