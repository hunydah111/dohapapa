import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_DOMAIN } from "@/lib/site";

// 카카오톡·페이스북·X 등에서 링크 공유 시 보이는 썸네일(1200×630).
// 타이포그래피 중심 (2026-07 캐릭터 강등: 일러스트 제거) — 우드톤 배경 위 큰 카피 + 3-티어 칩,
// 하단 = 코랄 밴드에 흰 워드마크(축소 시에도 대비 확보). 한글은 Black Han Sans(OFL) 번들 폰트.
export const contentType = "image/png";

const SIZE = { width: 1200, height: 630 };
const ALT = "비집고 — 내 돈으로 살 집 어디까지?";

// og:image URL에 버전 경로(/opengraph-image/<id>)를 박는다. 카카오·페북·폰 로컬은 이미지 URL
// 글자 단위로 캐싱하므로, 디자인을 바꾸면 OG_VERSION을 올려 "한 번도 본 적 없는 새 URL"로 강제
// 교체 → 모든 캐시 계층이 새로 긁어간다. (카카오 OG 디버거 캐시 초기화로도 안 풀릴 때의 확실한 우회)
const OG_VERSION = "5";

export function generateImageMetadata() {
  return [
    {
      id: OG_VERSION,
      alt: ALT,
      size: SIZE,
      contentType,
    },
  ];
}

export default async function Image() {
  const font = await readFile(
    join(process.cwd(), "assets/BlackHanSans-Regular.ttf"),
  );

  const chip = (label: string, bg: string) => (
    <div
      style={{
        display: "flex",
        background: bg,
        color: "#fffdf8",
        fontSize: 40,
        padding: "10px 28px",
        borderRadius: 999,
      }}
    >
      {label}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FBF3E4",
          fontFamily: "BlackHanSans",
        }}
      >
        {/* 상단: 후크 카피 — 타이포가 메시지 전부 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            padding: "20px 72px 8px",
          }}
        >
          <div style={{ fontSize: 116, color: "#6B4226", lineHeight: 1.12 }}>통장 까면,</div>
          <div style={{ fontSize: 116, color: "#FF8A4C", lineHeight: 1.12 }}>동네 나온다.</div>
          <div style={{ display: "flex", flexDirection: "row", gap: 14, marginTop: 30 }}>
            {chip("안정형", "#e0a23a")}
            {chip("균형형", "#FF8A4C")}
            {chip("도전형", "#6B4226")}
          </div>
          <div style={{ fontSize: 34, color: "#6B4226", marginTop: 28, opacity: 0.75 }}>
            수도권 아파트단지 1만 곳 · 30초컷
          </div>
        </div>

        {/* 하단 코랄 밴드 — 흰글자 워드마크(최고 대비) */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#e8662f",
            padding: "0 44px",
            height: 152,
          }}
        >
          <div style={{ fontSize: 106, color: "#fffdf8", lineHeight: 1 }}>비집고</div>
          <div style={{ fontSize: 38, color: "#ffe6dc" }}>
            {`수도권 아파트 · 국토부 실거래가 · ${SITE_DOMAIN}`}
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [
        { name: "BlackHanSans", data: font, style: "normal", weight: 400 },
      ],
    },
  );
}
