import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// 카카오톡·페이스북·X 등에서 링크 공유 시 보이는 썸네일(1200×630).
// 비집고 브랜드: 따뜻한 코랄. 상단 = 브랜드 로고(아파트+비버) + 호기심 후크 카피 + 3-티어 칩,
// 하단 = 코랄 밴드에 흰 워드마크(축소 시에도 대비 확보). 한글은 Black Han Sans(OFL) 번들 폰트.
export const contentType = "image/png";

const SIZE = { width: 1200, height: 630 };
const ALT = "비집고 — 내 돈으로 살 집 어디까지?";

// og:image URL에 버전 경로(/opengraph-image/<id>)를 박는다. 카카오·페북·폰 로컬은 이미지 URL
// 글자 단위로 캐싱하므로, 디자인을 바꾸면 OG_VERSION을 올려 "한 번도 본 적 없는 새 URL"로 강제
// 교체 → 모든 캐시 계층이 새로 긁어간다. (카카오 OG 디버거 캐시 초기화로도 안 풀릴 때의 확실한 우회)
const OG_VERSION = "3";

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
  const logoBuf = await readFile(
    join(process.cwd(), "public/biji/biji-hero.png"),
  );
  const logo = `data:image/png;base64,${logoBuf.toString("base64")}`;

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
          background: "#f5ecd9",
          fontFamily: "BlackHanSans",
        }}
      >
        {/* 상단: 브랜드 로고 + 후크 카피 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
            padding: "20px 44px 8px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            width={440}
            height={440}
            style={{ objectFit: "contain" }}
            alt=""
          />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 32 }}>
            <div style={{ fontSize: 90, color: "#3a322c", lineHeight: 1.12 }}>내 돈으로</div>
            <div style={{ fontSize: 90, color: "#3a322c", lineHeight: 1.12 }}>살 집 어디까지?</div>
            <div style={{ display: "flex", flexDirection: "row", gap: 14, marginTop: 26 }}>
              {chip("안정형", "#e0a23a")}
              {chip("균형형", "#fe7644")}
              {chip("도전형", "#3a322c")}
            </div>
            <div style={{ fontSize: 34, color: "#6b6157", marginTop: 26 }}>
              소득·자산만 넣으면 30초에 정리 · 무료
            </div>
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
            수도권 아파트 · 국토부 실거래가 · homenasia.kr
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
