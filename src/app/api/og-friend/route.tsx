// 친구 비교용 OG 이미지 (1200×630) — `?f={slug}.{sigungu}` 받아서 친구 비지 카드 동적 생성.
// 카톡 미리보기에서 "[강남구 퀸비버] 친구가 너랑 비교하래!" 시각 hook → 클릭 유발.
//
// page.tsx의 generateMetadata에서 openGraph.images로 이 URL을 가리킴. 친구 URL마다 다른
// 등급/시군구라 변주는 자동. 캐시 키는 ?f= 값 그대로.

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { decodeFriend, friendDdayLabel } from "@/lib/friendShare";
import { composeBijiName } from "@/lib/bijiName";
import { pickTierImage, BEAVER_TIERS } from "@/lib/budgetPercentile";
import { SITE_DOMAIN } from "@/lib/site";

export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const friendParam = url.searchParams.get("f");
  const tag = decodeFriend(friendParam);
  // 잘못된/없는 ?f= → 폴백: 기본 비집고 브랜드 OG (단순). 깨진 링크에서도 안전.
  const tier = tag?.tier ?? BEAVER_TIERS.gukmin;
  const sigungu = tag?.sigungu ?? "수도권";
  const name = tag ? composeBijiName(sigungu, tier) : "비집고 비버";
  const ddayLabel = friendDdayLabel(tag);

  const font = await readFile(join(process.cwd(), "assets/BlackHanSans-Regular.ttf"));
  const tierImagePath = pickTierImage(tier.image, sigungu);
  const bijiBuf = await readFile(join(process.cwd(), "public", tierImagePath.replace(/^\//, "")));
  const biji = `data:image/png;base64,${bijiBuf.toString("base64")}`;

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
        {/* 좌측: 친구 비지 — bottom 정렬, 큰 그림자 */}
        <div
          style={{
            display: "flex",
            width: "48%",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 40,
            paddingLeft: 30,
            background: "#ffffff",
            margin: 30,
            borderRadius: 32,
            boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={biji}
            width={420}
            height={420}
            style={{ objectFit: "contain" }}
            alt=""
          />
        </div>

        {/* 우측: 비교 invite 카피 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "52%",
            padding: "70px 64px 60px 0",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 32,
              color: tier.theme.textTone === "light" ? "rgba(255,255,255,0.85)" : "#6e5b46",
              marginBottom: 10,
            }}
          >
            🦫 친구가 판정 까고 던졌다
          </div>
          <div
            style={{
              fontSize: name.length >= 8 ? 68 : name.length >= 6 ? 84 : 110,
              lineHeight: 1.02,
              marginTop: 4,
              color: tier.theme.nameColor ?? (tier.theme.textTone === "light" ? "#ffffff" : tier.theme.accent),
            }}
          >
            {name}
          </div>
          {ddayLabel && (
            <div
              style={{
                fontSize: 64,
                lineHeight: 1.05,
                marginTop: 14,
                color: tier.theme.textTone === "light" ? "#ffe9a8" : "#c4521f",
              }}
            >
              {ddayLabel}
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 34,
              marginTop: 22,
              color: tier.theme.textTone === "light" ? "#ffffff" : "#3a2c1d",
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
              marginTop: 44,
            }}
          >
            <div
              style={{
                fontSize: 56,
                color: tier.theme.textTone === "light" ? "#ffffff" : tier.theme.accent,
                lineHeight: 1,
              }}
            >
              비집고
            </div>
            <div
              style={{
                fontSize: 24,
                color: tier.theme.textTone === "light" ? "rgba(255,255,255,0.7)" : "#9c8a72",
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
      // 캐시 — 친구 URL은 한 번 만들면 영원히 같은 비지/카피라 길게 캐싱 가능.
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
