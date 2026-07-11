import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_DOMAIN } from "@/lib/site";
import dailyPatchRaw from "@/data/dailyPatch.json";
import { pickHeadlines, type MajorItem, type PatchItem } from "@/lib/patchNote";

// 카카오톡·페이스북·X 등에서 링크 공유 시 보이는 썸네일(1200×630).
// v7 (2026-07-11): 프리미엄 하이브리드 — 제호 "비집고" = Pretendard Bold, 헤드라인 = 세리프
//   (나눔명조), 본문 = Pretendard, 코랄 밴드 얇게+굵게(mock-hybrid 검증 매핑).
// v6 (2026-07-08): 신문 1면 정체성 — 종이 톤 + 코랄 플레이트 제호 + "오늘의 헤드라인".
// 크론이 매일 데이터를 커밋 → 재배포 → 썸네일도 그날 지면이 된다.
export const contentType = "image/png";

const SIZE = { width: 1200, height: 630 };
const ALT = "비집고 — 국토부 실거래로 매일 아침 발행하는 신문 1면";

// 지면 톤 — paperTone과 동일 팔레트(og는 폰트/모듈 제약으로 값만 복사).
const PAPER = "#fbfaf6";
const INK = "#191713";
const INK_SOFT = "#5d574c";
const CORAL = "#e8571f";

interface PatchLike {
  generatedAt: string | null;
  newDealCount: number;
  major?: MajorItem[];
  nerf?: PatchItem[];
}
const patch = dailyPatchRaw as unknown as PatchLike;

// 이미지 URL은 글자 단위로 캐싱된다(카카오·페북·폰 로컬) — 날짜를 경로에 박아
// 매일 "한 번도 본 적 없는 새 URL"이 되게 한다(디자인 개정은 v 프리픽스 증가).
const dateSlug = (patch.generatedAt ?? "pre").slice(0, 10);
const OG_ID = `v7-${dateSlug}`;

export function generateImageMetadata() {
  return [{ id: OG_ID, alt: ALT, size: SIZE, contentType }];
}

function koDateShort(iso: string | null): string {
  if (!iso) return "창간 준비호";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : iso;
}

export default async function Image() {
  // 프리미엄 하이브리드 폰트(mock-hybrid 미러): 나눔명조 Regular + Pretendard 3종.
  const [nanum, preSB, preR, preB] = await Promise.all([
    readFile(join(process.cwd(), "assets/NanumMyeongjo-Regular.ttf")),
    readFile(join(process.cwd(), "assets/Pretendard-SemiBold.otf")),
    readFile(join(process.cwd(), "assets/Pretendard-Regular.otf")),
    readFile(join(process.cwd(), "assets/Pretendard-Bold.otf")),
  ]);
  const SERIF = "Nanum";
  const SANS = "Pretendard";
  const SANS_B = "PretendardB";
  // 렌더와 같은 순수 함수로 헤드라인 재계산(v2.5 — 구운 headlines 필드는 신뢰하지 않는다).
  const top = pickHeadlines({
    major: patch.major ?? [],
    nerf: patch.nerf ?? [],
    newDealCount: patch.newDealCount ?? 0,
    todayISO: dateSlug === "pre" ? "2026-01-01" : dateSlug,
  }).top;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          fontFamily: SANS,
        }}
      >
        {/* 정보띠 + 먹 괘선(신문 상단 문법) */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "34px 56px 0",
            paddingBottom: 14,
            borderBottom: `5px solid ${INK}`,
            color: INK_SOFT,
            fontSize: 30,
          }}
        >
          <div style={{ display: "flex" }}>{koDateShort(patch.generatedAt)}</div>
          <div style={{ display: "flex" }}>오늘의 판 · 매일 아침 발행</div>
        </div>

        {/* 제호 플레이트 + 부제 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            margin: "26px 56px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              background: CORAL,
              color: PAPER,
              fontSize: 84,
              fontFamily: SANS_B,
              lineHeight: 1,
              padding: "14px 30px 20px",
            }}
          >
            비집고
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              color: INK_SOFT,
              fontSize: 30,
              lineHeight: 1.4,
            }}
          >
            <div style={{ display: "flex" }}>국토부 실거래 공개분으로</div>
            <div style={{ display: "flex" }}>매일 새벽 자동 발행</div>
          </div>
        </div>

        {/* 오늘의 헤드라인 — 지면 톱 그대로 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            margin: "0 56px",
          }}
        >
          <div style={{ display: "flex", color: CORAL, fontSize: 30, fontFamily: SANS_B }}>오늘의 헤드라인</div>
          <div
            style={{
              display: "flex",
              color: INK,
              fontSize: 66,
              fontFamily: SERIF,
              lineHeight: 1.32,
              marginTop: 12,
            }}
          >
            {top.text}
          </div>
        </div>

        {/* 하단 코랄 밴드 — 얇게 + 굵게·크게(Pretendard Bold), mock-hybrid 미러. */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            background: CORAL,
            padding: "0 56px",
            height: 108,
            color: PAPER,
          }}
        >
          <div style={{ display: "flex", fontSize: 40, fontFamily: SANS_B }}>통장 까면, 동네 나온다</div>
          <div style={{ display: "flex", fontSize: 46, fontFamily: SANS_B }}>{SITE_DOMAIN}</div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [
        { name: "Nanum", data: nanum, style: "normal", weight: 400 },
        { name: "PretendardSB", data: preSB, style: "normal", weight: 600 },
        { name: "Pretendard", data: preR, style: "normal", weight: 400 },
        { name: "PretendardB", data: preB, style: "normal", weight: 700 },
      ],
    },
  );
}
