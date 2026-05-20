import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// 카카오톡·페이스북·X 등에서 링크 공유 시 보이는 썸네일(1200×630).
// 한글 렌더를 위해 Black Han Sans(OFL) 폰트를 번들해 사용한다.
export const alt = "홈앤나사이 — 재미로 한번 돌려보는 내 집 찾기";
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
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
          color: "white",
          fontFamily: "BlackHanSans",
        }}
      >
        <div style={{ fontSize: 138, lineHeight: 1 }}>홈앤나사이</div>
        <div style={{ fontSize: 52, marginTop: 28, opacity: 0.96 }}>
          재미로 한번 돌려보는 내 집 찾기
        </div>
        <div style={{ fontSize: 34, marginTop: 56, opacity: 0.8 }}>
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
