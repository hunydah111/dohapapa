import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// 카카오톡·페이스북·X 등에서 링크 공유 시 보이는 썸네일(1200×630).
// 한글 렌더를 위해 Black Han Sans(OFL) 폰트를 번들해 사용한다.
export const alt = "홈앤나 — 내 월급으로 어디 살 수 있을까?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const font = await readFile(
    join(process.cwd(), "assets/BlackHanSans-Regular.ttf"),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ff7a59 0%, #7c3aed 100%)",
          color: "white",
          fontFamily: "BlackHanSans",
        }}
      >
        {/* 브랜드 마크 — 인디고 배경에서 보이게 좌:흰색 / 우:앰버 / 가운데:인디고 */}
        <svg
          width="138"
          height="138"
          viewBox="0 0 32 32"
          style={{ marginBottom: 28 }}
        >
          <path d="M16 4 L4 13 L4 26 Q4 28 6 28 L16 28 Z" fill="#ffffff" />
          <path d="M16 4 L28 13 L28 26 Q28 28 26 28 L16 28 Z" fill="#f59e0b" />
          <circle cx="16" cy="16" r="3.5" fill="#ff7a59" />
        </svg>
        <div style={{ fontSize: 168, lineHeight: 1 }}>홈앤나</div>
        <div style={{ fontSize: 62, marginTop: 28, opacity: 0.96 }}>
          내 월급으로 어디 살 수 있을까?
        </div>
        <div style={{ fontSize: 42, marginTop: 52, opacity: 0.8 }}>
          homenasia.kr
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "BlackHanSans",
          data: font,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
