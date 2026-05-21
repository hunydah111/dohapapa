import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// 카카오톡·페이스북·X 등에서 링크 공유 시 보이는 썸네일(1200×630).
// 비집고 브랜드: 비버 비지 + 워드마크. 한글은 Black Han Sans(OFL) 번들 폰트.
export const alt = "비집고 — 내 통장으로 어디 살 수 있을까?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const font = await readFile(
    join(process.cwd(), "assets/BlackHanSans-Regular.ttf"),
  );
  const beaverBuf = await readFile(join(process.cwd(), "assets/og-beaver.png"));
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
          gap: 36,
          background: "linear-gradient(135deg, #f7efe0 0%, #ead7b8 100%)",
          fontFamily: "BlackHanSans",
        }}
      >
        {/* 마스코트 비지 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beaver}
          width={420}
          height={480}
          style={{ objectFit: "contain" }}
          alt=""
        />
        {/* 워드마크 + 태그라인 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ fontSize: 168, lineHeight: 1, color: "#3a2c1d" }}>비집고</div>
          <div style={{ fontSize: 50, marginTop: 22, color: "#4f8a3f" }}>
            내 통장으로 어디 살 수 있을까?
          </div>
          <div style={{ fontSize: 34, marginTop: 40, color: "#9c8a72" }}>
            homenasia.kr
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "BlackHanSans", data: font, style: "normal", weight: 400 },
      ],
    },
  );
}
