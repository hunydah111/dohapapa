// 비집고 1면 — 홈 최상단 0입력 데일리 스트립, 신문 지면 조판 (2026-07-04 전면 재작성).
//
// 구조(위→아래): 정보띠 → 제호(이코노미스트식 코랄 플레이트) → 오늘의 헤드라인(뉴스가치 사다리)
//   → 오늘의 온도 → [주요 거래] → [강세 거래] → [약세 동네] → [내 문턱 · 구독자란] → CTA → 콜로폰.
// 하락(버프) 실명 리스트는 2026-07-06 사장 지시로 폐지 — 급락 단지 실명 노출 = 주민 비하.
//   하락은 [약세 동네](시군구 집계)로만 다루고, buff 데이터는 분석용으로만 남긴다.
//
// 조판 토큰(bijigo-front-mockup 시안 A): 종이 #fbfaf6 · 먹 #191713 · 보조 #5d574c
//   · 괘선 #c9c3b4 · 코랄 #e8571f(제호 플레이트·CTA·판정 링크만) · 그린 #2e7d52. 명조는 셀프호스팅.
//
// 정직성 원칙: 실거래 신고는 계약 후 최대 30일 지연 → 카피는 항상 "공개" 기준.
// "실시간" 금지 · 미래 예측 금지 · 캐릭터/이모지 0.
// 시세 방향색 = 한국 시세면 문법: 상승 UP(빨강)·하락 DOWN(파랑) (2026-07-06 사장 확정).
// 빨강은 '상승 수치·기호' 전용 — 경보·조바심 용도 사용은 여전히 금지.
// 서버 컴포넌트 — 데이터는 빌드/배포 시점 JSON(매일 새벽 5:30 파이프라인이 갱신).
// 하위호환: 라이브 dailyPatch.json은 다음 크론 전까지 major/temp 필드가 없다(구 스키마)
//   → 둘 다 optional, 없으면 해당 코너/줄을 조용히 접는다.

import dailyPatchRaw from "@/data/dailyPatch.json";
import dailyPulseRaw from "@/data/dailyPulse.json";
import tempSeriesRaw from "@/data/tempSeries.json";
import regionPeaksRaw from "@/data/regionPeaks.json";
import regionChaseRaw from "@/data/regionChase.json";
import {
  pickHeadlines,
  passesStrongGate,
  ymdShortText,
  type MajorItem,
  type PatchTemp,
  type RegionPulse,
  type CancellationItem,
  type BusiestRegion,
  type HeadlinesResult,
} from "@/lib/patchNote";
import { majorAnalysis } from "@/lib/majorAnalysis";
import { REFERENCE_PHASES, phaseAvg, type TempSeriesFile } from "@/lib/tempSeries";
import { aggregateZoneTemp, type ZoneTemp } from "@/lib/zones";
import { areaMeta } from "@/lib/areaLabel";
import { CONTACT_EMAIL } from "@/lib/site";
import { TILE_MAP, TILE_GRID_COLS, tileLevel } from "@/lib/tileMap";
import {
  recoveryBand,
  topRecovered,
  type RegionPeaksFile,
} from "@/lib/regionPeaks";
import {
  CHASE_BASE_SIGUNGU,
  CHASE_MIN_DEALS,
  buildChaseBoard,
  findOvertakes,
  type ChaseBoard,
  type ChaseBoardRow,
  type RegionChaseFile,
} from "@/lib/regionChase";
import { ThresholdGauge, DailyFrontPing } from "./ThresholdGauge";
import { DealMiniMap } from "./DealMiniMap";
import { ShareButton } from "./ShareButton";
import { InstallButton } from "./InstallButton";
// 하이브리드 폰트·조판 토큰 — 공유 모듈(단일 소스). 중복 선언 금지.
// 세리프(serif=나눔명조)=코너 제목·헤드라인·단지명 · pretendard=본문·숫자·제호 워드마크.
import {
  serif,
  pretendard,
  PAPER,
  INK,
  INK_SOFT,
  RULE,
  CORAL,
  UP,
  DOWN,
} from "@/lib/paperTone";

interface PatchItem {
  kind: "nerf" | "buff";
  sigungu: string;
  dong: string;
  apt: string;
  areaM2: number;
  band: string;
  priceKrw: number;
  medianKrw: number;
  /** 단지 자기 중위가 대비 이탈률(소수) — 내부 선별 필터 값. 화면 노출 금지("시세" 단정 위험). */
  pct: number;
  dealDate: string;
  /** 최근 1년 실거래 최고가(원) — 구 스키마·구 스냅샷엔 없음. */
  maxKrw?: number | null;
  /** 같은 단지×밴드 직전 실거래가(원, 60일 내) — 화면 노출용 팩트. 구 스키마엔 없음. */
  prevKrw?: number | null;
  /** 직전 실거래 계약일 YYYY-MM-DD. */
  prevDate?: string | null;
  /** 직전 실거래의 층 — "직전 '26.6.18 4.2억(7층)" 병기. 구 스키마엔 없음. */
  prevFloor?: number | null;
  /** (price − prevKrw) / prevKrw — 화면 노출용 등락(팩트 기준). */
  pctVsPrev?: number | null;
  /** 폴링창 내 자기 제외 최고가 — 헤드라인 rung 판정용. */
  windowMaxKrw?: number | null;
  /** 단지 좌표 — 행 미니맵·카카오맵 링크용. 스냅샷 미등재면 null. */
  lat?: number | null;
  lng?: number | null;
  /** 층 — 행 메타 "12층" 태그. 구 스키마엔 없음. */
  floor?: number | null;
  /** 최근접 지하철역 거리(m) — 행 메타 "역 350m" 태그. 구 스키마엔 없음. */
  nearestSubwayM?: number | null;
}

interface DailyPatch {
  generatedAt: string | null;
  scopeDays: number;
  /** 구버전 placeholder 호환 — 새 파이프라인은 mode 를 쓴다. */
  seeded?: boolean;
  /** "bootstrap" = 창간호, "daily" = 오늘 신규 공개 diff,
   *  "merged" = 주말 저볼륨 합산(최근 2~3일 공개분 — 라벨 병기 의무). */
  mode?: "bootstrap" | "daily" | "merged";
  /** merged 합산 구간 — "주말 합산 · {M/D}~{M/D} 공개분" 라벨용. merged 아닐 땐 null. */
  mergedFromDate?: string | null;
  mergedToDate?: string | null;
  newDealCount: number;
  scopeDealCount: number;
  nerf: PatchItem[];
  buff: PatchItem[];
  /** 오늘 공개된 15억 이상 중개거래 전부 — 구 스키마엔 없음(optional 필수). */
  major?: MajorItem[];
  /** 오늘의 온도 — 구 스키마엔 없음. 표본 부족이면 null. */
  temp?: PatchTemp | null;
  /** 권역 온도 8행용 시군구별 온도(#20) — 구 스키마엔 없음 → 8행 조용히 생략. */
  regionTemp?: Record<string, PatchTemp>;
  /** [약세 동네] — 구 스키마엔 없음(optional 필수). 없거나 비면 코너 자체 생략. */
  weakRegions?: RegionPulse[];
  /** 대칭 강세 집계 — 데이터만, UI 비게재([강세 거래] 실명이 담당). */
  strongRegions?: RegionPulse[];
  /** [오늘의 해제] — 구 스키마엔 없음. 0건이면 코너 생략. */
  cancellations?: CancellationItem[];
  /** 오늘 최다 공개 동네 — 구 스키마엔 없음. 비면 줄 생략. */
  busiestRegions?: BusiestRegion[];
  /** [오늘의 거래 지도] — fresh 유효 거래의 시군구별 전체 집계(0건 제외).
   *  구 스키마엔 없음 → 지도 코너 자체를 조용히 생략. */
  regionCounts?: Record<string, number>;
  /** 헤드라인 묶음(톱 1 + 서브 ≤3) — 크론이 굽는 데이터 기록. ⚠️ v2.5부터 렌더엔 안 쓴다:
   *  게이트 이전 크론이 구운 오보성 헤드라인이 살아남지 않도록, 렌더가 같은 순수 함수
   *  (pickHeadlines)로 재계산한다(아래 본문 주석 참조). */
  headlines?: HeadlinesResult;
  latestDealDate: string | null;
}

interface DailyPulse {
  checkedAt: string | null;
  latestDealDate: string | null;
  recentCount: number | null;
  newSincePrev: number | null;
}

// placeholder(빈 배열)는 never[] 로 추론되므로 명시 캐스팅.
const patch = dailyPatchRaw as unknown as DailyPatch;
const pulse = dailyPulseRaw as unknown as DailyPulse;
const tempSeries = tempSeriesRaw as unknown as TempSeriesFile;
const regionPeaks = regionPeaksRaw as unknown as RegionPeaksFile;
const regionChase = regionChaseRaw as unknown as RegionChaseFile;

// ── 포맷터 ────────────────────────────────────────────────────────────────────
/** "2026-06-28" → "6/28". 깨진 값은 그대로 반환. (당일·당월성 표기 전용 — 계약일 등) */
function md(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[1])}/${Number(m[2])}` : date;
}

/** "2026-06-18" → "'26.6.18" — 직전/종전 비교 표기 전용(연도 병기 의무, 올해여도 통일).
 *  직전 거래가 작년일 수 있어 월일만 쓰면 오독된다(2026-07-07 사장 지시). 헤드라인
 *  포맷(patchNote.ymdShortText)과 단일 규칙. */
const ymdShort = ymdShortText;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** "2026-07-04" → "2026년 7월 4일 금요일". 깨진 값은 그대로. */
function koDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(`${date}T00:00:00Z`);
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일 ${WEEKDAYS[d.getUTCDay()]}요일`;
}

/** 원 → "18.5억" (소수 1자리, .0 은 생략). */
function eok(krw: number): string {
  const v = krw / 100_000_000;
  const s = v.toFixed(1);
  return `${s.endsWith(".0") ? s.slice(0, -2) : s}억`;
}

// 면적 표기("84.7㎡ · 32~35평")는 공유 헬퍼(areaLabel.ts) — sqm 3중 중복 통합(2026-07-08).

/** 이탈률(소수) → "8.8" (절대값, 소수 1자리, .0 은 생략). */
function pctAbs(pct: number): string {
  const s = (Math.abs(pct) * 100).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** 주요 거래 분석 라인용 짧은 구 이름 — "강남구"→"강남"(어그로 톤). 복합 시군구
 *  ("수원시 팔달구")는 오독 방지로 그대로. 공유 카드·페이지와 동일 규칙(미러). */
function shortRegion(sigungu: string): string {
  return sigungu.includes(" ") ? sigungu : sigungu.replace(/[구시군]$/, "");
}

/** 계약일(YYYY-MM-DD) ~ 공개일(ISO) 경과일 — 뒤늦은 신고 판별용(UTC 일수). 깨진 값은 0. */
function daysSince(dealDate: string, generatedAtISO: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dealDate);
  if (!m) return 0;
  const deal = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const gen = Date.parse(generatedAtISO);
  if (Number.isNaN(gen)) return 0;
  return Math.floor((gen - deal) / 86_400_000);
}

/** 역거리 태그 상한(m) — 1km 초과면 "역세권" 정보가치가 없어 생략. */
const SUBWAY_TAG_MAX_M = 1000;

/** 층·역거리 메타 태그 — "12층 · 역 350m". 없는 값은 생략, 둘 다 없으면 null. */
function floorSubwayTag(
  floor?: number | null,
  nearestSubwayM?: number | null,
): string | null {
  const parts: string[] = [];
  if (floor != null) parts.push(`${floor}층`);
  if (nearestSubwayM != null && nearestSubwayM <= SUBWAY_TAG_MAX_M)
    parts.push(`역 ${Math.round(nearestSubwayM)}m`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// ── 조판 부품 ─────────────────────────────────────────────────────────────────
/** 동네면 링크 — 지면 동네명 → /r/[시군구]. 먹색 유지 + 점선 밑줄(절제된 링크 표시)로
 *  지면 조판 톤을 깨지 않는다. 공백 포함 시군구("수원시 팔달구")는 encodeURIComponent. */
function RegionLink({
  sigungu,
  children,
  className,
  style,
  ...rest
}: {
  sigungu: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
} & Record<`data-${string}`, string>) {
  return (
    <a
      href={`/r/${encodeURIComponent(sigungu)}`}
      title={`${sigungu} 동네면`}
      className={`underline decoration-dotted underline-offset-2 ${className ?? ""}`}
      style={{ color: INK, ...style }}
      {...rest}
    >
      {children}
    </a>
  );
}

/** 코너 라벨 — 먹색 바탕 흰 글씨 사각 칩 + 라인 우측 끝 미세 출처 워터마크.
 *  어느 코너를 스크린샷해도 "bijigo.kr"가 담긴다(2026-07-07 사장 지시). 코너당 1개,
 *  10px·INK_SOFT·소문자·링크 아님 — 덕지덕지 금지, 절제. */
function CornerLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <span
        className="inline-block px-2 py-[3px] text-[11px] font-bold tracking-[0.18em]"
        style={{ background: INK, color: PAPER }}
      >
        {children}
      </span>
      <span
        aria-hidden="true"
        className="shrink-0 text-[10px] tracking-[0.04em]"
        style={{ color: INK_SOFT }}
      >
        bijigo.kr
      </span>
    </div>
  );
}

function CornerNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[10.5px] leading-[1.55]" style={{ color: INK_SOFT }}>
      {children}
    </p>
  );
}

// ── 권역 온도 8행 (#20) — 온도 코너의 접힘 하위 블록 (헌장 ⑦ 지면 예산: 기본 접힘) ──────
/** 권역 행 표시 최소 표본 — 미만이면 비율 대신 "표본 부족"(숫자는 혼자 못 나온다, 헌장 ②). */
const ZONE_TEMP_MIN_MATCHED = 5;

/** 8권역 지리 배치 (3열 × 4행 타일 지도). 라벨 키. 빈 칸은 비워둔다.
 *  경기북부(위) · 서울 5분면(서북/도심/동북 · 서남/동남) · 인천(좌) · 경기남부(아래). */
const ZONE_GRID: Record<string, { col: number; row: number }> = {
  "경기 북부": { col: 2, row: 1 },
  "서북권": { col: 1, row: 2 },
  "도심권": { col: 2, row: 2 },
  "동북권": { col: 3, row: 2 },
  "인천": { col: 1, row: 3 },
  "서남권": { col: 2, row: 3 },
  "동남권": { col: 3, row: 3 },
  "경기 남부": { col: 2, row: 4 },
};
/** 온도 net(높게−낮게 비율) → 타일 배경·글자색. 표본 부족은 회색. 시세 방향색(빨강=높게 우세). */
function zoneTint(above: number, below: number, matched: number): { bg: string; fg: string } {
  if (matched < ZONE_TEMP_MIN_MATCHED) return { bg: "#efe9da", fg: INK_SOFT };
  const net = (above - below) / matched; // -1 ~ 1
  if (net >= 0.15) return { bg: "#f0b2ac", fg: "#711410" };
  if (net > 0) return { bg: "#f7d8d3", fg: "#a5231c" };
  if (net > -0.15) return { bg: "#d6e0ee", fg: "#1f4e82" };
  return { bg: "#b4c7e2", fg: "#143761" };
}

// 권역 온도 "지도"(사장 2026-07-11: 8행 텍스트 → 타일 지도). 이름은 호출부 호환 유지.
function ZoneTempRows({ zones }: { zones: ZoneTemp[] }) {
  return (
    <details className="group mt-2">
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-bold [&::-webkit-details-marker]:hidden"
        style={{ color: INK_SOFT }}
      >
        <span>권역별 온도 지도 — 8권역</span>
        <span
          aria-hidden="true"
          className="text-[11px] transition-transform duration-150 group-open:rotate-90"
        >
          ▸
        </span>
      </summary>
      <div className="pt-1.5">
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {zones.map((z) => {
            const pos = ZONE_GRID[z.label];
            if (!pos) return null;
            const ok = z.matched >= ZONE_TEMP_MIN_MATCHED;
            const above = ok ? Math.round((z.above / z.matched) * 100) : 0;
            const below = ok ? Math.round((z.below / z.matched) * 100) : 0;
            const t = zoneTint(z.above, z.below, z.matched);
            return (
              <div
                key={z.id}
                className="flex min-h-[58px] flex-col items-center justify-center rounded-[3px] px-1 py-1.5 text-center leading-tight tabular-nums"
                style={{ gridColumn: pos.col, gridRow: pos.row, background: t.bg, color: t.fg }}
              >
                <span className="text-[11.5px] font-bold">{z.label}</span>
                {ok ? (
                  <span className="mt-0.5 text-[10.5px] font-semibold">
                    ▲{above} ▼{below}
                  </span>
                ) : (
                  <span className="mt-0.5 text-[9.5px]">표본 부족</span>
                )}
                <span className="text-[8.5px]" style={{ opacity: 0.75 }}>
                  {z.matched}건
                </span>
              </div>
            );
          })}
        </div>
        <CornerNote>
          색 = 직전 실거래(60일 내) 대비 높게(빨강)·낮게(파랑) 우세 · ▲높게% ▼낮게% · 권역 =
          서울 5개 생활권(2030 서울생활권계획)·경기 남부/북부(도 북부청사 관할)·인천. 지리
          배치(순위 아님).
        </CornerNote>
      </div>
    </details>
  );
}

// ── [오늘의 거래 지도] — 수도권 82개 시군구 타일 격자 (시안 B, 서버 렌더 · JS 0) ──────
/** 타일 농도색 — 시안 B 범례: 0건=바탕 / 1~2 / 3~6 / 7건+(먹·흰글자). 인덱스 = tileLevel. */
const TILE_FILL = ["#f3efe6", "#e4ddc9", "#c9bfa0", INK] as const;
const TILE_BORDER = "#e3ddcd";
/** 강세/약세 링 — 방향색 3px + 안쪽 종이색 1.5px 분리선(이중 inset — 먹 타일 위에서도 보임). */
function tileRing(color: string): string {
  return `inset 0 0 0 3px ${color}, inset 0 0 0 4.5px ${PAPER}`;
}

/** 거래 지도 본체 — 각 타일 = /r/[시군구] 링크. 농도 = 오늘 공개 건수,
 *  링 = 강세(UP)·약세(DOWN) 발생 시군구(강세 우선). 링 타일은 굵은 글씨. */
function TradeMap({
  regionCounts,
  strongSet,
  weakSet,
}: {
  regionCounts: Record<string, number>;
  strongSet: ReadonlySet<string>;
  weakSet: ReadonlySet<string>;
}) {
  return (
    <div
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${TILE_GRID_COLS}, minmax(0, 1fr))` }}
    >
      {Object.entries(TILE_MAP).map(([sigungu, tile]) => {
        const count = regionCounts[sigungu] ?? 0;
        const level = tileLevel(count);
        const ring = strongSet.has(sigungu) ? UP : weakSet.has(sigungu) ? DOWN : null;
        return (
          <a
            key={sigungu}
            href={`/r/${encodeURIComponent(sigungu)}`}
            title={`${sigungu} ${count}건 — 동네면`}
            className={`flex aspect-square items-center justify-center text-center text-[8px] leading-[1.05] tracking-[-0.02em] ${
              ring ? "font-extrabold" : "font-bold"
            }`}
            style={{
              gridColumn: tile.col,
              gridRow: tile.row,
              background: TILE_FILL[level],
              color: level === 3 ? PAPER : level >= 1 ? INK : INK_SOFT,
              border: `1px solid ${TILE_BORDER}`,
              boxShadow: ring ? tileRing(ring) : undefined,
            }}
          >
            {tile.label}
          </a>
        );
      })}
    </div>
  );
}

/** 범례 견본칩 — 시안 B 그대로(10px 사각 + 링 견본은 2.5px inset). */
function TileSwatch({ bg, ring }: { bg: string; ring?: string }) {
  return (
    <i
      aria-hidden="true"
      className="mr-[3px] inline-block h-[10px] w-[10px] align-[-1px]"
      style={{
        background: bg,
        border: `1px solid ${TILE_BORDER}`,
        boxShadow: ring ? `inset 0 0 0 2.5px ${ring}` : undefined,
      }}
    />
  );
}

function TradeMapLegend() {
  return (
    <div
      className="mt-[7px] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9.5px]"
      style={{ color: INK_SOFT }}
    >
      <span><TileSwatch bg={TILE_FILL[0]} />0건</span>
      <span><TileSwatch bg={TILE_FILL[1]} />1~2</span>
      <span><TileSwatch bg={TILE_FILL[2]} />3~6</span>
      <span><TileSwatch bg={TILE_FILL[3]} />7건+</span>
      <span><TileSwatch bg={PAPER} ring={UP} />강세 발생</span>
      <span><TileSwatch bg={PAPER} ring={DOWN} />약세 발생</span>
    </div>
  );
}

// ── [회복률 지도] — TradeMap 기하 재사용, 타일 농도만 회복률 밴드로(시안 B 색문법). ──────
/** "2021-10" → "'21.10" — 전고점 월 병기(TOP5·각주). */
function ymApos(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? `'${m[1].slice(2)}.${Number(m[2])}` : ym;
}
/** 회복률(0~1+) → "92" (전고점 대비 %, 정수). */
function recoveryPct(recovery: number): number {
  return Math.round(recovery * 100);
}

/** 회복률 밴드별 타일 채움색 — 인덱스 = recoveryBand.
 *  0 = <75%(진한 파랑) / 1 = 75~90%(연파랑) / 2 = 90~100%(빨강) / 3 = ≥100%(진한 빨강).
 *  회복=강세=빨강, 미회복=약세=파랑 — 기존 강세/약세 지도 색문법 일치(경보빨강 아님). */
const RECOVERY_FILL = ["#1f4e82", "#c7d8ea", "#e8a0a4", "#c9252d"] as const;
/** 밴드별 글자색 — 진한 배경(0·3)은 흰 글씨, 연한 배경(1·2)은 먹. */
const RECOVERY_TEXT = [PAPER, INK, INK, PAPER] as const;

/** 회복률 지도 본체 — TILE_MAP·TILE_GRID_COLS 기하 재사용, 각 타일 = /r/[시군구] 링크.
 *  수록 안 된 시군구(peaks.regions 에 없음)는 TradeMap 의 0건 타일과 동일한 바탕색. */
function RecoveryMap({
  peaks,
}: {
  peaks: RegionPeaksFile;
}) {
  return (
    <div
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${TILE_GRID_COLS}, minmax(0, 1fr))` }}
    >
      {Object.entries(TILE_MAP).map(([sigungu, tile]) => {
        const entry = peaks.regions[sigungu];
        const band = entry ? recoveryBand(entry.recovery) : null;
        return (
          <a
            key={sigungu}
            href={`/r/${encodeURIComponent(sigungu)}`}
            title={
              entry
                ? `${sigungu} 회복 ${recoveryPct(entry.recovery)}% (${ymApos(entry.peakYm)} 전고점 대비) — 동네면`
                : `${sigungu} — 동네면`
            }
            className="flex aspect-square items-center justify-center text-center text-[8px] font-bold leading-[1.05] tracking-[-0.02em]"
            style={{
              gridColumn: tile.col,
              gridRow: tile.row,
              background: band === null ? TILE_FILL[0] : RECOVERY_FILL[band],
              color: band === null ? INK_SOFT : RECOVERY_TEXT[band],
              border: `1px solid ${TILE_BORDER}`,
            }}
          >
            {tile.label}
          </a>
        );
      })}
    </div>
  );
}

function RecoveryLegend() {
  return (
    <div
      className="mt-[7px] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9.5px]"
      style={{ color: INK_SOFT }}
    >
      <span><TileSwatch bg={RECOVERY_FILL[3]} />신고가</span>
      <span><TileSwatch bg={RECOVERY_FILL[2]} />90~100%</span>
      <span><TileSwatch bg={RECOVERY_FILL[1]} />75~90%</span>
      <span><TileSwatch bg={RECOVERY_FILL[0]} />75% 미만</span>
      <span><TileSwatch bg={TILE_FILL[0]} />미수록</span>
    </div>
  );
}

/** 가장 빨리 회복한 동네 TOP5 — 회복률 상위(신고점 돌파 우선). 하위/워스트 없음(헌장 ⑤). */
function RecoveryTop5({
  top,
}: {
  top: { sigungu: string; recovery: number; peakYm: string }[];
}) {
  return (
    <div className="mt-3">
      <p className="m-0 text-[11px] font-bold tracking-[0.08em]" style={{ color: INK_SOFT }}>
        가장 빨리 회복한 동네 TOP5
      </p>
      <div className="mt-1">
        {top.map((t, i) => {
          const breached = t.recovery >= 1;
          return (
            <div
              key={t.sigungu}
              className={`flex items-baseline gap-2 py-[4px] tabular-nums ${i > 0 ? "border-t border-dotted" : ""}`}
              style={i > 0 ? { borderColor: RULE } : undefined}
            >
              <span className="w-[16px] shrink-0 text-right text-[12px] font-bold" style={{ color: INK_SOFT }}>
                {i + 1}.
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: INK }}>
                <RegionLink sigungu={t.sigungu}>{t.sigungu}</RegionLink>{" "}
                <span className="text-[10px] font-normal" style={{ color: INK_SOFT }}>
                  {ymApos(t.peakYm)} 전고점 대비
                </span>
              </span>
              <span className="shrink-0 text-right text-[13px] font-extrabold" style={{ color: UP }}>
                {breached ? "신고가" : `회복 ${recoveryPct(t.recovery)}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 월요 분석면 — 추격판(#19: 강남=100 인덱스 궤적·역전 마커) + 격차 게이지(#10) ──────
//   게재 = 월요일 호에만(헌장 ⑦ 지면 예산 — 요일제). 선정은 전부 기계 규칙(공평):
//   최신 분기 인덱스 상위 = 강남과 격차가 가장 좁은 구. placeholder·표본 미달이면 코너 생략.
const CHASE_BOARD_ROWS = 5; // 게이지 행 수
const CHASE_CHART_LINES = 3; // 차트 궤적 수 — 넘치면 선이 엉켜 못 읽는다

/** "2025-Q4" → "'25.4Q". 깨진 값은 그대로. */
function quarterApos(q: string): string {
  const m = /^(\d{4})-Q(\d)$/.exec(q);
  return m ? `'${m[1].slice(2)}.${m[2]}Q` : q;
}

function ChaseChart({ file, rows }: { file: RegionChaseFile; rows: ChaseBoardRow[] }) {
  const charted = rows.slice(0, CHASE_CHART_LINES);
  const n = file.quarters.length;
  if (n < 2 || charted.length === 0) return null;
  const X0 = 8;
  const X1 = 336; // 우측 여백 — 궤적 끝 라벨("동작구 91")이 잘리지 않게
  const xOf = (i: number) => X0 + (i / (n - 1)) * (X1 - X0);
  // y 도메인 — 표시 값 전부 + 기준 100, ±4 여유.
  let lo = 100;
  let hi = 100;
  for (const r of charted)
    for (const v of r.index)
      if (v != null) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
  const yMin = Math.floor((lo - 4) / 5) * 5;
  const yMax = Math.ceil((hi + 4) / 5) * 5;
  const yOf = (v: number) => 12 + ((yMax - v) / (yMax - yMin)) * 74;
  // 궤적 위계 — 1위 본선, 2·3위 보조(연함·점선). 색은 먹 단색(시세 방향색 오남용 금지).
  const strokes = [
    { width: 1.8, opacity: 1, dash: undefined as string | undefined },
    { width: 1.4, opacity: 0.55, dash: undefined as string | undefined },
    { width: 1.4, opacity: 0.55, dash: "4 3" },
  ];
  const baseY = yOf(100);
  // 궤적 끝 라벨 충돌 방지 — 기준선 라벨("강남 100")까지 포함해 위→아래로 최소 10px 벌림.
  const labelY = [baseY - 3, ...charted.map((r) => yOf(r.latest) + 3)];
  const order = labelY.map((_, i) => i).sort((a, b) => labelY[a] - labelY[b]);
  for (let k = 1; k < order.length; k++) {
    if (labelY[order[k]] - labelY[order[k - 1]] < 10)
      labelY[order[k]] = labelY[order[k - 1]] + 10;
  }
  return (
    <svg
      viewBox="0 0 396 104"
      className="block h-auto w-full"
      role="img"
      aria-label={`추격판 — 강남 100 기준 분기 인덱스 궤적 (${quarterApos(file.quarters[0])}~)`}
    >
      {/* 기준선 — 강남 100 (점선·먹) */}
      <line x1={X0} y1={baseY.toFixed(1)} x2="392" y2={baseY.toFixed(1)} stroke={INK} strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.6" />
      <text x="392" y={labelY[0].toFixed(1)} textAnchor="end" fontSize="8.5" fontWeight="700" fill={INK} stroke={PAPER} strokeWidth="2.6" paintOrder="stroke" strokeLinejoin="round">
        강남 100
      </text>
      {charted.map((r, k) => {
        const pts: string[] = [];
        for (let i = 0; i < n; i++) {
          const v = r.index[i];
          if (v != null) pts.push(`${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`);
        }
        const s = strokes[k];
        // 역전 마커 — 강남과 우열이 뒤집힌 분기(양쪽 관측 있을 때만, lib가 보장).
        const marks = findOvertakes(file, CHASE_BASE_SIGUNGU, r.sigungu).filter(
          (m) => r.index[file.quarters.indexOf(m.quarter)] != null,
        );
        return (
          <g key={r.sigungu}>
            <polyline fill="none" stroke={INK} strokeWidth={s.width} strokeOpacity={s.opacity} strokeDasharray={s.dash} points={pts.join(" ")} />
            {marks.map((m) => {
              const i = file.quarters.indexOf(m.quarter);
              return (
                <circle
                  key={m.quarter}
                  cx={xOf(i).toFixed(1)}
                  cy={yOf(r.index[i]!).toFixed(1)}
                  r="3.2"
                  fill={PAPER}
                  stroke={INK}
                  strokeWidth="1.6"
                />
              );
            })}
            <text
              x={(xOf(r.latestQi) + 4).toFixed(1)}
              y={labelY[k + 1].toFixed(1)}
              fontSize="9"
              fontWeight="700"
              fill={INK}
              fillOpacity={s.opacity}
              stroke={PAPER}
              strokeWidth="2.6"
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {r.sigungu} {Math.round(r.latest)}
            </text>
          </g>
        );
      })}
      {/* x축 눈금 — 처음·가운데·마지막 분기 */}
      {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
        <text key={i} x={xOf(i).toFixed(1)} y="102" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="8.5" fill={INK_SOFT}>
          {quarterApos(file.quarters[i])}
        </text>
      ))}
    </svg>
  );
}

/** 격차 게이지(#10) — 강남 100 만재 바 + 격차가 좁은 순 상위 구. 바 = 인덱스 비율. */
function ChaseGaugeRows({ file, board }: { file: RegionChaseFile; board: ChaseBoard }) {
  // 게이지 스케일 — 기준 100과 최고 인덱스 중 큰 쪽(강남 초과 구가 있으면 그 구가 만재).
  const scale = Math.max(100, ...board.rows.map((r) => r.latest));
  const rows = [
    { sigungu: board.base, latest: 100, sub: null as string | null },
    ...board.rows.map((r) => ({
      sigungu: r.sigungu,
      latest: r.latest,
      sub: `${quarterApos(file.quarters[r.firstQi])} ${Math.round(r.first)} → 지금 ${Math.round(r.latest)} (${r.delta > 0 ? "+" : ""}${r.delta}p)`,
    })),
  ];
  return (
    <div className="mt-3">
      <p className="m-0 text-[11px] font-bold tracking-[0.08em]" style={{ color: INK_SOFT }}>
        격차 게이지 — 강남과 격차가 좁은 순
      </p>
      <div className="mt-1">
        {rows.map((r, i) => (
          <div
            key={r.sigungu}
            className={`py-[4px] ${i > 0 ? "border-t border-dotted" : ""}`}
            style={i > 0 ? { borderColor: RULE } : undefined}
          >
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="w-[52px] shrink-0 truncate text-[12px] font-bold" style={{ color: INK }}>
                {i === 0 ? r.sigungu : <RegionLink sigungu={r.sigungu}>{r.sigungu}</RegionLink>}
              </span>
              <span className="h-[7px] min-w-0 flex-1 self-center" style={{ background: "#efeadd" }}>
                <span
                  className="block h-full"
                  style={{
                    width: `${Math.min(100, (r.latest / scale) * 100).toFixed(1)}%`,
                    background: i === 0 ? INK : INK_SOFT,
                  }}
                />
              </span>
              <span className="w-[30px] shrink-0 text-right text-[12.5px] font-extrabold" style={{ color: INK }}>
                {Math.round(r.latest)}
              </span>
            </div>
            {r.sub && (
              <p className="m-0 pl-[60px] text-[10px] leading-[1.5] tabular-nums" style={{ color: INK_SOFT }}>
                {r.sub}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 월요 분석면 코너 본체 — 회복률 지도 코너와 같은 접힘 문법. 보드 불성립이면 null. */
function ChaseCorner({ file }: { file: RegionChaseFile }) {
  const board = buildChaseBoard(file, CHASE_BOARD_ROWS);
  if (!board) return null;
  const climber = board.topClimber;
  return (
    <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
          <span
            className="inline-block px-2 py-[3px] text-[11px] font-bold tracking-[0.18em]"
            style={{ background: INK, color: PAPER }}
          >
            월요 분석 — 추격판 · 강남 100
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span aria-hidden="true" className="text-[10px] tracking-[0.04em]" style={{ color: INK_SOFT }}>
              bijigo.kr
            </span>
            <span
              aria-hidden="true"
              className="text-[11px] transition-transform duration-150 group-open:rotate-90"
              style={{ color: INK_SOFT }}
            >
              ▸
            </span>
          </span>
        </summary>
        <div className="pt-2.5">
          <ChaseChart file={file} rows={board.rows} />
          <ChaseGaugeRows file={file} board={board} />
          {climber && (
            <p className="mb-0 mt-2 text-[11.5px] leading-[1.6] tabular-nums" style={{ color: INK }}>
              창 안 추격폭 1위 —{" "}
              <RegionLink sigungu={climber.sigungu} className="font-bold">
                {climber.sigungu}
              </RegionLink>{" "}
              <b>
                {climber.delta > 0 ? "+" : ""}
                {climber.delta}p
              </b>{" "}
              <span style={{ color: INK_SOFT }}>
                ({quarterApos(file.quarters[climber.firstQi])} {Math.round(climber.first)} → 지금{" "}
                {Math.round(climber.latest)})
              </span>
            </p>
          )}
          <CornerNote>
            인덱스 = 그 분기 구 전체 거래 평단가(원/㎡)의 상위 5% 진입값을 강남구 같은 값으로
            나눈 비율 × 100 — 관측값이지 시세 지수 아님. 분기 표본 {CHASE_MIN_DEALS}건 미만은
            제외 · ◯ = 강남과 우열이 뒤집힌 분기 · 상위 구 선정은 전 구 동일 규칙(최신 인덱스
            순) · 주간 갱신.
          </CornerNote>
        </div>
      </details>
    </section>
  );
}

/** "가장 많이 공개된 동네" 줄 — 지도 코너 아래 보조(시안 B), 구 스키마에선 헤드라인 블록.
 *  data-region 은 기존 셀렉터 호환 유지. */
function BusiestLine({
  busiestRegions,
  isMerged,
}: {
  busiestRegions: BusiestRegion[];
  isMerged: boolean;
}) {
  return (
    <p className="mb-0 mt-2 text-[12px] leading-[1.6] tabular-nums" style={{ color: INK_SOFT }}>
      {isMerged ? "이번 합산에서" : "오늘"} 가장 많이 공개된 동네 —{" "}
      {busiestRegions.map((r, i) => (
        <span key={r.sigungu}>
          {i > 0 && " · "}
          <RegionLink sigungu={r.sigungu} data-region={r.sigungu} className="font-bold">
            {r.sigungu}
          </RegionLink>{" "}
          {r.count.toLocaleString("ko-KR")}건
        </span>
      ))}
    </p>
  );
}

// ── 온도 추이 차트(최대 약 6년, '20.9~) — 시안 B 축 차트, 서버 SVG · 라이브러리 0 ────────────────
/** 월별 above/matched 비율 곡선 + 50% 중립 점선 + 오늘 점(빨강). 계약월 기준.
 *  x축 눈금은 데이터 길이에 적응 — 3년 이상이면 연 단위('25), 미만이면 3분위 월('25.7).
 *  그릴 점이 2개 미만(표본 전무)이면 null — 게이지 바만 남는다. */
function TempTrendChart({
  series,
  todayAbovePct,
  mergedNote,
}: {
  series: TempSeriesFile;
  todayAbovePct: number;
  mergedNote: string;
}) {
  const n = series.months.length;
  if (!series.generatedAt || n < 2) return null;
  const X0 = 26;
  const X1 = 356;
  const TODAY_X = 384;
  const xOf = (i: number) => X0 + (i * (X1 - X0)) / (n - 1);
  // 동적 y축 — 온도는 35~65% 사이에서 노는 지표라 0~100 고정축이면 변화가 안 보인다
  // (2026-07-06 사장 지시). 데이터 범위 ±4pp, 5 단위 스냅, 50% 균형선은 항상 도메인 안에.
  const pctVals: number[] = [];
  for (let i = 0; i < n; i++) {
    if (series.matched[i] > 0) pctVals.push((series.above[i] / series.matched[i]) * 100);
  }
  if (pctVals.length < 2) return null;
  pctVals.push(todayAbovePct);
  // 국면 참조 척도(v2.4 사장 지시) — 임의 임계("불장=60%") 단정 금지, 역사적 관측 평균만.
  // phaseAvg는 구간 월 6개 이상 관측 시에만 값 — 소급 백필이 차면 참조선이 자동 등장.
  const phaseLines = REFERENCE_PHASES.flatMap((phase) => {
    const avg = phaseAvg(series, phase);
    return avg === null ? [] : [{ phase, avg }];
  });
  for (const pl of phaseLines) pctVals.push(pl.avg); // 도메인이 참조선을 포함하도록
  const yMin = Math.min(45, Math.max(0, Math.floor((Math.min(...pctVals) - 4) / 5) * 5));
  const yMax = Math.max(55, Math.min(100, Math.ceil((Math.max(...pctVals) + 4) / 5) * 5));
  const yOf = (p: number) => 68 - ((p - yMin) / (yMax - yMin)) * 60;
  const yMid = yOf(50);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (!(series.matched[i] > 0)) continue; // 표본 0 달은 선에서 제외
    pts.push({ x: xOf(i), y: yOf((series.above[i] / series.matched[i]) * 100) });
  }
  if (pts.length < 2) return null;
  const todayY = yOf(todayAbovePct);
  // "오늘 nn%" 라벨 기준선 y — 국면 참조선 라벨의 충돌 회피 판정에도 쓴다.
  const todayLabelY = todayY >= 52 ? todayY - 7 : todayY + 13;
  const line = [...pts, { x: TODAY_X, y: todayY }]
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  // x축 눈금 — 연 단위(1월 달) 또는 3분위. "오늘" 라벨(x=370)과 안 겹치는 범위.
  const ticks: { x: number; label: string }[] = [];
  if (n >= 36) {
    for (let i = 0; i < n; i++) {
      if (series.months[i].endsWith("-01"))
        ticks.push({ x: xOf(i), label: `'${series.months[i].slice(2, 4)}` });
    }
  } else {
    // 중복 인덱스 제거 — n이 아주 작으면(2~3) 3분위가 겹친다.
    for (const i of [...new Set([0, Math.floor(n / 3), Math.floor((2 * n) / 3)])]) {
      const ym = series.months[i];
      ticks.push({ x: xOf(i), label: `'${ym.slice(2, 4)}.${Number(ym.slice(5, 7))}` });
    }
  }
  // 짧은 구간(소급 수집 전) 안내 — 백필이 채워지면 자동으로 사라진다.
  const shortWindow = n <= 13;
  // 국면 참조선이 하나도 없으면(백필 전) 시리즈 자체 요약 한 줄을 캡션에 병기.
  let seriesSummary: string | null = null;
  if (phaseLines.length === 0) {
    let aSum = 0;
    let mSum = 0;
    let maxP = -Infinity;
    let minP = Infinity;
    let maxYm = "";
    let minYm = "";
    for (let i = 0; i < n; i++) {
      if (!(series.matched[i] > 0)) continue;
      const p = (series.above[i] / series.matched[i]) * 100;
      aSum += series.above[i];
      mSum += series.matched[i];
      if (p > maxP) {
        maxP = p;
        maxYm = series.months[i];
      }
      if (p < minP) {
        minP = p;
        minYm = series.months[i];
      }
    }
    if (mSum > 0) {
      const f = (ym: string) => `'${ym.slice(2, 4)}.${Number(ym.slice(5, 7))}`;
      seriesSummary = `최근 ${n}개월 — 평균 ${Math.round((aSum / mSum) * 100)}% · 최고 ${Math.round(maxP)}%(${f(maxYm)}) · 최저 ${Math.round(minP)}%(${f(minYm)})`;
    }
  }
  return (
    <div className="mt-2">
      <svg
        viewBox="0 0 396 76"
        className="block h-auto w-full"
        role="img"
        aria-label={`온도 추이 — 직전 거래보다 높게 팔린 비율(계약월 기준, ${series.months[0]}~). 오늘 ${todayAbovePct}%`}
      >
        <text x="0" y="12" fontSize="8.5" fill={INK_SOFT}>{yMax}%</text>
        <text x="7" y={(yMid + 3).toFixed(1)} fontSize="8.5" fill={INK_SOFT}>50</text>
        <text x="7" y="70" fontSize="8.5" fill={INK_SOFT}>{yMin}</text>
        <line x1={X0} y1="8" x2="392" y2="8" stroke="#eee8da" strokeWidth="1" />
        {/* 50% 균형 점선 — 동적 도메인 안에서 위치 계산 */}
        <line x1={X0} y1={yMid.toFixed(1)} x2="392" y2={yMid.toFixed(1)} stroke={RULE} strokeWidth="1" strokeDasharray="3 3" />
        <line x1={X0} y1="68" x2="392" y2="68" stroke={RULE} strokeWidth="1" />
        {/* 국면 참조선 — 해당 기간 관측 평균(임의 기준 아님). "오늘" 라벨과 겹치면 좌측 배치. */}
        {phaseLines.map(({ phase, avg }) => {
          const y = yOf(avg);
          const color = phase.tone === "up" ? UP : DOWN;
          const clash = Math.abs(y - todayLabelY) < 11;
          return (
            <g key={phase.key}>
              <line
                x1={X0}
                y1={y.toFixed(1)}
                x2="392"
                y2={y.toFixed(1)}
                stroke={color}
                strokeOpacity="0.3"
                strokeWidth="1.3"
                strokeDasharray="5 3"
              />
              {/* 종이색 halo(paintOrder stroke) — 점선·본선 위에서도 라벨이 묻히지 않게. */}
              <text
                x={clash ? X0 + 3 : 356}
                y={(y - 2.5).toFixed(1)}
                textAnchor={clash ? "start" : "end"}
                fontSize="8"
                fontWeight="700"
                fill={color}
                stroke={PAPER}
                strokeWidth="2.6"
                paintOrder="stroke"
                strokeLinejoin="round"
              >
                {phase.label.split("(")[0]} 평균 {Math.round(avg)}%
              </text>
            </g>
          );
        })}
        <polyline fill="none" stroke={INK} strokeWidth="1.8" points={line} />
        {/* 오늘 점 (공개 기준) */}
        <circle cx={TODAY_X} cy={todayY.toFixed(1)} r="3.4" fill={UP} />
        <text
          x="378"
          y={todayLabelY.toFixed(1)}
          textAnchor="end"
          fontSize="9"
          fontWeight="700"
          fill={UP}
          stroke={PAPER}
          strokeWidth="2.6"
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          오늘 {todayAbovePct}%
        </text>
        {ticks.map((t) => (
          <text key={t.label} x={t.x.toFixed(1)} y="76" fontSize="8.5" fill={INK_SOFT}>
            {t.label}
          </text>
        ))}
        <text x="370" y="76" fontSize="8.5" fill={INK_SOFT}>오늘</text>
      </svg>
      <p className="m-0 mt-1 text-[10px] leading-[1.5]" style={{ color: INK_SOFT }}>
        온도 추이 — 직전 거래보다 높게 팔린 비율. 점선 = 50% 균형선 · 선 = 계약월 기준 ·
        붉은 점 = 오늘 공개분
        {phaseLines.length > 0 && " · 참조선 = 해당 기간 관측 평균(임의 기준 아님)"}
        {shortWindow && " · 국토부 수집 구간 기준 — 소급 수집 중"}
        {mergedNote}.
        {seriesSummary && (
          <>
            <br />
            {seriesSummary}
          </>
        )}
      </p>
    </div>
  );
}

/** 행 펼침 힌트 — details marker 대용 ▸ (group-open 시 90° 회전). */
function RowHint() {
  return (
    <span
      aria-hidden="true"
      className="ml-0.5 inline-block text-[9px] transition-transform duration-150 group-open:rotate-90"
      style={{ color: INK_SOFT }}
    >
      ▸
    </span>
  );
}

// ── 행 펼침 아이콘(인라인 SVG · 이모지 금지 — Win10 글리프 사태). 16x16 viewBox, currentColor. ──
/** 지도 핀. */
function MapPinIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1.4C5.4 1.4 3.3 3.5 3.3 6.1c0 3.3 4.7 8.5 4.7 8.5s4.7-5.2 4.7-8.5C12.7 3.5 10.6 1.4 8 1.4z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="6" r="1.7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
/** 상승 꺾은선(시세). */
function ChartIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none">
      <polyline
        points="2,11 6,7 9,9.5 14,4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="10.5,4 14,4 14,7.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
/** 원근 도로(로드뷰). */
function RoadIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M5.4 2.2h5.2l2 11.6H3.4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 3.4v1.6M8 6.9v1.6M8 10.4v1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 border px-2 py-1 text-[11px] font-semibold no-underline"
      style={{ borderColor: RULE, color: INK }}
    >
      {children}
      <span>{label}</span>
    </a>
  );
}

/** 행 펼침 내용 — 단지 미니맵(좌표·카카오 JS 키 있을 때만) + 지도·네이버 시세·로드뷰 아이콘.
 *  카카오맵은 좌표 오독 방지로 검색(?q=) 우선(CandidateCard 교훈), 로드뷰는 좌표 있을 때만. */
function DealLocation({
  apt,
  sigungu,
  lat,
  lng,
}: {
  apt: string;
  sigungu: string;
  lat?: number | null;
  lng?: number | null;
}) {
  const hasCoords = lat != null && lng != null;
  // 검색 딥링크(?q=)는 좌표 URL 리다이렉트 함정(CandidateCard 주석) 회피 — 단지 위치가 바로 뜬다.
  const kakaoMapHref = `https://map.kakao.com/?q=${encodeURIComponent(`${sigungu} ${apt}`)}`;
  // 네이버 부동산(m.land) — CandidateCard 미러(단지명만 넘김, 고유 매칭 시 단지 페이지 직행).
  const naverHref = `https://m.land.naver.com/search/result/${encodeURIComponent(apt)}`;
  // 카카오 로드뷰 — 좌표 있을 때만(포인트 필요). 없으면 아이콘 생략.
  const roadviewHref = hasCoords ? `https://map.kakao.com/link/roadview/${lat},${lng}` : null;
  return (
    <div className="mb-1.5 mt-1 flex flex-col gap-1.5 border p-2" style={{ borderColor: RULE }}>
      {hasCoords && <DealMiniMap label={apt} lat={lat!} lng={lng!} />}
      <div className="flex flex-wrap items-center gap-1.5">
        <IconLink href={kakaoMapHref} label="지도">
          <MapPinIcon />
        </IconLink>
        <IconLink href={naverHref} label="네이버 시세">
          <ChartIcon />
        </IconLink>
        {roadviewHref && (
          <IconLink href={roadviewHref} label="로드뷰">
            <RoadIcon />
          </IconLink>
        )}
      </div>
    </div>
  );
}

/** 행을 네이티브 <details>로 — 탭하면 위치(미니맵+카카오맵 링크) 펼침. JS 없이 동작. */
function DealDetails({
  item,
  children,
}: {
  item: { apt: string; sigungu: string; lat?: number | null; lng?: number | null };
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      <summary className="block cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {children}
      </summary>
      <DealLocation apt={item.apt} sigungu={item.sigungu} lat={item.lat} lng={item.lng} />
    </details>
  );
}

/** 주요 거래 행 — 점선 괘선 · 숫자 tabular-nums · 가격 우측 정렬.
 *  가격 바(시안 B): 바 폭 = 오늘 major 최고가(maxKrw) 대비 비율, 붉은 눈금 = 그 단지
 *  windowMaxKrw(기간 내 최고가) 위치 — 없으면 눈금 생략.
 *  서브라인: 기준점(기간 내 최고 거래가) 병기 — 스냅샷 1년 최고 우선, 없으면 폴링창 2개월.
 *  최고가 갱신이면 근거 병기 — "갱신 (종전 {억} · {M/D})" (2개월 기준일 때만 날짜 존재). */
function MajorRow({
  item,
  divider,
  maxKrw,
  lateDays,
}: {
  item: MajorItem;
  divider: boolean;
  /** 오늘 major 최고가(원) — 가격 바 기준. 0이면 바 생략. */
  maxKrw: number;
  /** 계약 후 공개까지 걸린 일수 — 뒤늦은 신고면 "N일 만에 공개" 태그. 아니면 null. */
  lateDays?: number | null;
}) {
  const refMax = item.windowMaxKrw ?? null;
  const tag = floorSubwayTag(item.floor, item.nearestSubwayM);
  return (
    <div
      className={`py-[5.5px] tabular-nums ${divider ? "border-t border-dotted" : ""}`}
      style={divider ? { borderColor: RULE } : undefined}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: INK }}>
          {/* 단지명 = 세리프(나눔명조) — 프리미엄 하이브리드. 면적·역거리 메타는 Pretendard.
              구 병기(사장 2026-07-11) — 수도권 전체가 섞여 동만으론 위치가 안 보임. 구가 링크. */}
          <span className={`${serif.className} text-[14.5px]`}>
            {item.dong} {item.apt}
          </span>{" "}
          <RegionLink sigungu={item.sigungu}>
            <span className="text-[11.5px] font-semibold" style={{ color: INK_SOFT }}>
              ({item.sigungu})
            </span>
          </RegionLink>{" "}
          <span className="text-[11px]" style={{ color: INK_SOFT }}>
            {areaMeta(item.areaM2)}{tag ? ` · ${tag}` : ""}
          </span>
          {lateDays != null && (
            <span
              className="ml-1 whitespace-nowrap rounded-sm px-1 text-[10px] font-bold"
              style={{ background: "#efe9da", color: INK_SOFT }}
              title="계약은 지났지만 오늘 국토부에 처음 공개된 거래"
            >
              {lateDays}일 만에 공개
            </span>
          )}
          <RowHint />
        </span>
        <span className="shrink-0 text-right text-[13px] font-semibold" style={{ color: INK }}>
          {eok(item.priceKrw)}
        </span>
        <span className="w-[62px] shrink-0 text-right text-[11px]" style={{ color: INK_SOFT }}>
          계약 {md(item.dealDate)}
        </span>
      </div>
      {/* 가격 바 — 폭 = 오늘 최고가 대비. 붉은 눈금 = 그 단지 기간 내 최고가 위치(우측 클램프). */}
      {maxKrw > 0 && (
        <div className="relative mt-1 h-[4px]" style={{ background: "#efe9da" }}>
          <span
            className="absolute inset-y-0 left-0"
            style={{
              width: `${Math.min(100, (item.priceKrw / maxKrw) * 100).toFixed(2)}%`,
              background: INK,
            }}
          />
          {refMax !== null && (
            <span
              className="absolute top-[-3px] h-[10px] w-[2px]"
              style={{
                left: `${Math.min(99.5, (refMax / maxKrw) * 100).toFixed(2)}%`,
                background: UP,
              }}
            />
          )}
        </div>
      )}
      {/* 직전 거래 서브라인(2026-07-08 사장 지시 — 헌장 ② 숫자는 혼자 못 나온다):
          같은 단지×평형 60일 내 직전 실거래의 가격·날짜·층 + 대비 %. 없으면 생략. */}
      {item.prevKrw != null && item.pctVsPrev != null && (
        <div className="mt-[3px] text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
          직전 {eok(item.prevKrw)}
          {item.prevDate
            ? ` (${ymdShort(item.prevDate)}${item.prevFloor != null ? `·${item.prevFloor}층` : ""})`
            : ""}{" "}
          대비{" "}
          <b
            style={{
              color: item.pctVsPrev > 0 ? UP : item.pctVsPrev < 0 ? DOWN : INK,
            }}
          >
            {item.pctVsPrev > 0 ? "+" : item.pctVsPrev < 0 ? "−" : "±"}
            {pctAbs(item.pctVsPrev)}%
          </b>
        </div>
      )}
      {/* 기준점 서브라인 — 비교 대상 없으면(신축 첫거래 등) 생략.
          종전 표기엔 연도 병기('25.11.3)·층 병기(값 있을 때만 — 구 스냅샷은 생략). */}
      {refMax !== null && item.refMaxPeriod && (
        <div className="mt-[3px] text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
          {item.priceKrw > refMax ? (
            <>
              <b style={{ color: UP }}>— {item.refMaxPeriod} 내 최고가 갱신</b> (종전{" "}
              {eok(refMax)}
              {item.windowMaxDate ? ` · ${ymdShort(item.windowMaxDate)}` : ""}
              {item.windowMaxFloor != null ? ` · ${item.windowMaxFloor}층` : ""})
            </>
          ) : item.priceKrw === refMax ? (
            <b style={{ color: INK }}>— {item.refMaxPeriod} 내 최고가 동률</b>
          ) : (
            /* 최고가 대비 % 병기(2026-07-07 사장 지시) — 시세 방향이 아니라 "정점과의
               거리"라 방향색 금지, 숫자만 먹 굵게. 갱신·동률 분기엔 중복 표기 금지. */
            <>
              최근 {item.refMaxPeriod} 최고 {eok(refMax)}
              {item.windowMaxDate
                ? ` (${ymdShort(item.windowMaxDate)}${item.windowMaxFloor != null ? `·${item.windowMaxFloor}층` : ""})`
                : ""}{" "}
              (대비{" "}
              <b style={{ color: INK }}>
                −{pctAbs((item.priceKrw - refMax) / refMax)}%
              </b>
              )
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** [강세 거래] 행 — ▲ 먹 (빨간 경보색 금지). 비교는 전부 실거래 팩트(직전 거래, 날짜 병기).
 *  하락 실명 행은 폐지(주민 비하 금지) — 하락은 [약세 동네] 시군구 집계로만 다룬다. */
function StrongRow({ item, divider }: { item: PatchItem; divider: boolean }) {
  const tag = floorSubwayTag(item.floor, item.nearestSubwayM);
  return (
    <div
      className={`py-[5.5px] tabular-nums ${divider ? "border-t border-dotted" : ""}`}
      style={divider ? { borderColor: RULE } : undefined}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: INK }}>
          <span aria-hidden="true" className="mr-1 font-bold" style={{ color: UP }}>
            ▲
          </span>
          {/* 단지명 = 세리프(나눔명조) — 프리미엄 하이브리드. 면적 메타는 Pretendard. */}
          <span className={`${serif.className} text-[14.5px]`}>
            <RegionLink sigungu={item.sigungu}>{item.sigungu}</RegionLink> {item.apt}
          </span>{" "}
          <span className="text-[11px]" style={{ color: INK_SOFT }}>
            {areaMeta(item.areaM2)}{tag ? ` · ${tag}` : ""}
          </span>
          <RowHint />
        </span>
        <span className="shrink-0 text-right text-[13px] font-semibold" style={{ color: UP }}>
          +{pctAbs(item.pctVsPrev!)}%
        </span>
      </div>
      {/* 팩트 라인 — 직전 거래 날짜(연도 병기 의무)·층(값 있을 때만) 병기. */}
      <div className="mt-[1px] pl-[18px] text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
        직전 {ymdShort(item.prevDate!)} {eok(item.prevKrw!)}
        {item.prevFloor != null ? `(${item.prevFloor}층)` : ""} → {eok(item.priceKrw)} · 계약{" "}
        {md(item.dealDate)}
      </div>
    </div>
  );
}

/** [오늘의 해제] 행 — 국토부 공개 행정 사실만 인쇄. 해제 사유는 데이터에 없으므로
 *  어떤 해석·단정도 붙이지 않는다("조작" 류 단어 금지). 경보색 금지 — 먹 톤. */
function CancellationRow({ item, divider }: { item: CancellationItem; divider: boolean }) {
  const tag = floorSubwayTag(item.floor, item.nearestSubwayM);
  return (
    <div
      className={`py-[5.5px] tabular-nums ${divider ? "border-t border-dotted" : ""}`}
      style={divider ? { borderColor: RULE } : undefined}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: INK }}>
          <RegionLink sigungu={item.sigungu}>{item.dong}</RegionLink> {item.apt}{" "}
          <span className="text-[11px] font-normal" style={{ color: INK_SOFT }}>
            {areaMeta(item.areaM2)}{tag ? ` · ${tag}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right text-[13px] font-bold" style={{ color: INK }}>
          {eok(item.priceKrw)}
        </span>
        <span className="w-[62px] shrink-0 text-right text-[11px]" style={{ color: INK_SOFT }}>
          계약 {md(item.dealDate)}
        </span>
      </div>
      {/* 최고가 공개 이력 — wasTopInWindow(다른 유효 거래 전부보다 높았음)일 때만 인쇄. */}
      {item.wasTopInWindow && (
        <div className="mt-[1px] text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
          — 해제 전까지 이 단지 최고가로 공개돼 있었음
        </div>
      )}
    </div>
  );
}

/** [약세 동네] 행 — 시군구 집계(실명 단지 없음), 그린 톤. 기준은 직전 실거래(팩트). */
function WeakRegionRow({ item, divider }: { item: RegionPulse; divider: boolean }) {
  return (
    <div
      className={`flex items-baseline gap-2 py-[5.5px] tabular-nums ${divider ? "border-t border-dotted" : ""}`}
      style={divider ? { borderColor: RULE } : undefined}
    >
      <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: INK }}>
        <span aria-hidden="true" className="mr-1 font-extrabold" style={{ color: DOWN }}>
          ▼
        </span>
        <RegionLink sigungu={item.sigungu}>{item.sigungu}</RegionLink>
      </span>
      <span className="shrink-0 text-right text-[13px] font-extrabold" style={{ color: DOWN }}>
        직전 거래 대비 평균 −{pctAbs(item.avgPct)}%
      </span>
      <span className="w-[46px] shrink-0 text-right text-[11px]" style={{ color: INK_SOFT }}>
        {item.count}건
      </span>
    </div>
  );
}

/** [주요 거래] 상위 노출 건수 — 초과분은 <details> 네이티브 펼치기(JS 없이). */
const MAJOR_VISIBLE = 10;
/** "N일 만에 공개" 태그 문턱 — 계약 후 이 일수 넘겨 오늘 공개된 15억+ 거래는 주요 거래
 *  행에 "N일 만에 공개" 태그를 붙인다(별도 코너 대신 인라인 — 2026-07-11 사장). 스코프
 *  14일보다 여유(21일)를 둬 갓 지난 건 태그 안 붙임(정상 신고 지연과 뒤늦은 신고 구분). */
const LATE_REPORT_MIN_DAYS = 21;
/** 환산 가정 — 월급 300 실수령 전액 저축(연 3,600만원). */
const SAVING_KRW_PER_YEAR = 3_000_000 * 12;

export function DailyFront() {
  // 발행 전(generatedAt null) = 창간 전 폴백 지면.
  const isPrelaunch = patch.generatedAt === null;
  const isBootstrap = patch.mode === "bootstrap";
  // 주말 저볼륨 합산 — 최근 2~3일 공개분을 합쳐 판독. 라벨 병기 의무(정직성).
  const isMerged =
    patch.mode === "merged" && !!patch.mergedFromDate && !!patch.mergedToDate;
  /** merged 각주 접미 — "각 각주"에 합산 구간을 병기(사장 지시). */
  const mergedNote = isMerged
    ? ` · 주말 합산 ${md(patch.mergedFromDate!)}~${md(patch.mergedToDate!)} 공개분`
    : "";
  // "오늘 공개 N건" — 창간호는 스코프 공개분, 일간/합산은 신규 diff.
  const openCount = isBootstrap ? patch.scopeDealCount : patch.newDealCount;

  // 하위호환 — 구 스키마(major/temp 없음)에서도 절대 깨지지 않는다.
  const major = patch.major; // undefined = 구 스키마, [] = 오늘 없음
  const temp = patch.temp ?? null;
  // 권역 온도 8행(#20) — regionTemp 없는 구 스키마면 null → 블록 조용히 생략.
  const zoneTemps = aggregateZoneTemp(patch.regionTemp);

  // 헤드라인 — 렌더 시점에 지면 데이터(major·nerf)로 재계산한다(v2.5 오보 게이트).
  // ⚠️ 빌드타임 확정값(patch.headlines)은 더 이상 렌더에 쓰지 않는다: 게이트 이전
  // 크론이 구운 헤드라인(금강펜테리움 +40.5% 류)이 다음 크론까지 살아남는 걸 막기 위해,
  // 같은 순수 함수(pickHeadlines — 게이트 내장)를 같은 JSON 입력으로 재실행한다.
  // 입력이 동일하므로 정상 데이터에선 빌드타임 값과 결과가 같다 — 데이터 기록용으로는 유지.
  const headlines = isPrelaunch
    ? null
    : pickHeadlines({
        major: major ?? [],
        nerf: patch.nerf,
        newDealCount: openCount,
        todayISO: patch.generatedAt!,
      });
  const headline = headlines?.top ?? null;
  const subHeadlines = headlines?.subs ?? [];

  const majorVisible = major?.slice(0, MAJOR_VISIBLE) ?? [];
  const majorRest = major?.slice(MAJOR_VISIBLE) ?? [];
  // "N일 만에 공개" 태그 — 계약 후 LATE_REPORT_MIN_DAYS 넘겨 오늘 공개된 15억+(뒤늦은 신고).
  // 별도 코너 대신 주요 거래 행에 인라인 태그로(2026-07-11 사장 — "그냥 주요거래에 넣어").
  // late 대형은 computePatch 가 이미 major(가격순)에 섞어 넣는다 → 원베일리급이 맨 위에.
  const lateDaysOf = (dealDate: string): number | null => {
    if (!patch.generatedAt) return null;
    const d = daysSince(dealDate, patch.generatedAt);
    return d >= LATE_REPORT_MIN_DAYS ? d : null;
  };
  // [주요 거래 분석] 어그로 라인 — 오늘 큰 거래에 잡힌 구별 직전 대비 평균(+건수).
  // ⚠️ "구 전체 시세" 아님 — 표본은 주요 거래분(종종 1~2건). 라벨·건수로 한계 명시.
  const majorAgg = majorAnalysis(major ?? []);
  // 환산 서브라인 — 1위(최고가) 거래 기준.
  const convYears = major && major[0] ? Math.round(major[0].priceKrw / SAVING_KRW_PER_YEAR) : 0;

  // [강세 거래] = 상승(너프) 실명만, 오보 게이트(passesStrongGate — 직전 거래 팩트
  // + 이중 합의 +7% + 상한 +30%) 통과분만. 게이트 이전 크론이 구운 데이터도 렌더에서
  // 걸러진다(금강펜테리움 사례). 하락(버프) 실명 리스트는 게재 폐지(주민 비하 금지).
  const strongs = patch.nerf.filter((i) => i.prevDate != null && passesStrongGate(i));
  // 구 스키마(직전 거래 필드 자체가 없는 nerf) — 새 기준 데이터가 올 때까지 예고 문구.
  // 게이트 탈락(필드는 있는데 조건 미달)은 legacy 가 아니라 "게재할 강세 없음"으로 처리.
  const strongLegacy =
    strongs.length === 0 &&
    patch.nerf.length > 0 &&
    patch.nerf.every((i) => i.prevKrw === undefined);
  const weakRegions = patch.weakRegions ?? []; // 구 스키마(undefined)·표본 없음([]) → 코너 생략
  const cancellations = patch.cancellations ?? []; // 구 스키마·0건 → 코너 생략
  // 요약 줄 "그중 M건은 해제 전까지 최고가로 공개돼 있었음"용 — wasTop 수.
  const cancelWasTopCount = cancellations.filter((c) => c.wasTopInWindow).length;
  const busiestRegions = patch.busiestRegions ?? []; // 구 스키마·비면 줄 생략

  // [오늘의 거래 지도] — 구 스키마(regionCounts 없음)면 코너 자체 생략(graceful).
  // 링: 강세 = [강세 거래] 게재 시군구(직전 거래 팩트 있는 상승), 약세 = [약세 동네] 시군구.
  const regionCounts = patch.regionCounts;
  const strongMapSet = new Set(strongs.map((i) => i.sigungu));
  const weakMapSet = new Set(weakRegions.map((r) => r.sigungu));

  // [회복률 지도] — placeholder(generatedAt null)·수록 0곳이면 코너 자체 생략(regionCounts
  // 없을 때 지도 생략하는 기존 패턴 미러). 수록 있으면 접힘 코너 + TOP5.
  const hasPeaks =
    regionPeaks.generatedAt !== null && Object.keys(regionPeaks.regions).length > 0;
  const recoveryTop5 = hasPeaks
    ? topRecovered(regionPeaks.regions, 5).map((r) => ({
        sigungu: r.sigungu,
        recovery: r.entry.recovery,
        peakYm: r.entry.peakYm,
      }))
    : [];
  // 가격 바 기준 — 오늘 major 최고가(major는 가격 내림차순 정렬 상태).
  const majorTopKrw = major && major.length > 0 ? major[0].priceKrw : 0;

  // [월요 분석면] — 월요일 호에만 게재(헌장 ⑦ 요일제). 발행 시각(ISO)을 KST로 옮겨 판정
  //   (Vercel 서버는 UTC). 데이터 placeholder(주간 크론 전)면 ChaseCorner가 스스로 접는다.
  const isMondayEdition =
    patch.generatedAt != null &&
    new Date(Date.parse(patch.generatedAt) + 9 * 3600_000).getUTCDay() === 1;

  // 온도 게이지 분할 — 위(먹) : 중립(괘선) : 아래(그린), matched 대비 비율.
  const tempPct = temp
    ? {
        above: Math.round((temp.above / temp.matched) * 100),
        below: Math.round((temp.below / temp.matched) * 100),
      }
    : null;

  return (
    <section className="mx-auto mb-4 w-full max-w-md">
      <DailyFrontPing />

      <div
        className={`${pretendard.className} px-[18px] pb-[22px] pt-[18px]`}
        style={{
          background: PAPER,
          color: INK,
          boxShadow: "0 2px 6px rgba(40,35,25,.14), 0 10px 32px rgba(40,35,25,.16)",
        }}
      >
        {/* ── 정보띠 ── */}
        <div
          className="flex justify-between pb-1.5 text-[10.5px] tracking-[0.05em] tabular-nums"
          style={{ color: INK_SOFT }}
        >
          <span>
            {isPrelaunch ? "창간 준비호" : koDate(patch.generatedAt!)}
            {/* 주말 합산 라벨 — 헤더 날짜 옆 병기(정직성 의무). */}
            {isMerged && (
              <>
                {" "}
                · 주말 합산 {md(patch.mergedFromDate!)}~{md(patch.mergedToDate!)} 공개분
              </>
            )}
          </span>
          <span>오늘의 판 · 매일 아침 발행</span>
        </div>

        {/* ── 제호 — 이코노미스트식 코랄 플레이트. "비집고" 워드마크 = Pretendard Bold
            (2026-07-11 프리미엄 하이브리드 — mock-hybrid 검증 매핑). 각진 사각(라운드·회전 금지).
            대비: #e8571f 위 #fbfaf6 ≈ 3.5:1 — 34px 굵은 글씨(large text) AA 통과. ── */}
        <header
          className="flex items-center justify-between px-0.5 pb-2.5 pt-3"
          style={{ borderTop: `2.5px solid ${INK}`, borderBottom: `1px solid ${INK}` }}
        >
          <h2
            className="m-0 inline-block px-3 py-1.5 text-[34px] font-bold leading-none tracking-[0.06em]"
            style={{ background: CORAL, color: PAPER }}
          >
            비집고
          </h2>
          <p className="m-0 text-right text-[10.5px] leading-[1.5]" style={{ color: INK_SOFT }}>
            통장 까면, 동네 나온다
            <br />
            예산으로 찾는 수도권 아파트
          </p>
        </header>

        {/* ── 오늘의 헤드라인 ── */}
        <div className="px-0.5 pb-3 pt-3.5" style={{ borderBottom: `1px solid ${RULE}` }}>
          {isPrelaunch ? (
            <>
              <h3
                className={`${serif.className} m-0 text-[22px] leading-[1.4] break-keep`}
              >
                첫 지면은 곧 발행됩니다
              </h3>
              <p className="mb-0 mt-1.5 text-[12.5px] leading-[1.6]" style={{ color: INK_SOFT }}>
                {pulse.newSincePrev != null && pulse.latestDealDate ? (
                  <>
                    오늘{" "}
                    <b className="tabular-nums" style={{ color: INK }}>
                      {pulse.newSincePrev.toLocaleString("ko-KR")}건
                    </b>{" "}
                    신규 공개 · 최신 계약 {md(pulse.latestDealDate)}
                  </>
                ) : (
                  <>
                    최근 2개월{" "}
                    <b className="tabular-nums" style={{ color: INK }}>
                      {(pulse.recentCount ?? 0).toLocaleString("ko-KR")}건
                    </b>{" "}
                    확인
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <h3
                className={`${serif.className} m-0 text-[22px] leading-[1.4] break-keep`}
              >
                {headline!.text}
              </h3>

              {/* 서브 헤드라인 — 세그먼트 칩([서울]·[경기·인천]·[9억 이하], CornerLabel보다
                  작게) + 명조 볼드 소형. 서브 0개면 섹션 자체 생략(구 스키마 포함). */}
              {subHeadlines.length > 0 && (
                <div className="mt-2 flex flex-col gap-[5px]">
                  {subHeadlines.map((s) => (
                    <div key={s.label} className="flex items-baseline gap-1.5">
                      <span
                        className="shrink-0 px-1.5 py-[2px] text-[9.5px] font-bold tracking-[0.12em]"
                        style={{ background: INK, color: PAPER }}
                      >
                        {s.label}
                      </span>
                      <span
                        className={`${serif.className} min-w-0 text-[14px] leading-[1.5] break-keep`}
                        style={{ color: INK }}
                      >
                        {s.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="mb-0 mt-1.5 text-[12.5px] leading-[1.6]" style={{ color: INK_SOFT }}>
                {isBootstrap ? (
                  <>
                    최근 {patch.scopeDays}일 계약 공개분{" "}
                    <b className="tabular-nums" style={{ color: INK }}>
                      {patch.scopeDealCount.toLocaleString("ko-KR")}건
                    </b>{" "}
                    판독 결과
                  </>
                ) : isMerged ? (
                  <>
                    주말 합산 {md(patch.mergedFromDate!)}~{md(patch.mergedToDate!)} 공개{" "}
                    <b className="tabular-nums" style={{ color: INK }}>
                      {patch.newDealCount.toLocaleString("ko-KR")}건
                    </b>{" "}
                    판독 결과
                  </>
                ) : (
                  <>
                    오늘 신규 공개{" "}
                    <b className="tabular-nums" style={{ color: INK }}>
                      {patch.newDealCount.toLocaleString("ko-KR")}건
                    </b>{" "}
                    판독 결과
                  </>
                )}
                {patch.latestDealDate && <>. 최신 계약 {md(patch.latestDealDate)}.</>}
                {headline!.kind === "first-trade" && (
                  <> 거래 이력이 없는 신축의 첫 공개 — 기준가가 찍히는 순간이다.</>
                )}
              </p>

              {/* 오늘의 온도 — 직전 실거래 대비(팩트 기준). 표본 부족·구 스키마면 생략. */}
              {temp && tempPct && (
                <div className="mt-2.5">
                  <p className="m-0 text-[12px] leading-[1.6] tabular-nums" style={{ color: INK_SOFT }}>
                    오늘의 온도 — 직전 거래보다 높게{" "}
                    <b style={{ color: UP }}>{tempPct.above}%</b> : 낮게{" "}
                    <b style={{ color: DOWN }}>{tempPct.below}%</b>{" "}
                    <span className="text-[10.5px]">
                      (직전 실거래가 있는 거래 {temp.matched.toLocaleString("ko-KR")}건 기준
                      {mergedNote})
                    </span>
                  </p>
                  <div
                    className="mt-1 flex h-[3px] w-full overflow-hidden"
                    role="img"
                    aria-label={`오늘 공개 거래 중 직전 실거래보다 높게 ${tempPct.above}%, 낮게 ${tempPct.below}%`}
                  >
                    <span style={{ width: `${tempPct.above}%`, background: UP }} />
                    <span
                      style={{
                        width: `${Math.max(0, 100 - tempPct.above - tempPct.below)}%`,
                        background: RULE,
                      }}
                    />
                    <span style={{ width: `${tempPct.below}%`, background: DOWN }} />
                  </div>

                  {/* 온도 추이 차트(시안 B) — tempSeries 없으면(placeholder) 게이지 바만. */}
                  <TempTrendChart
                    series={tempSeries}
                    todayAbovePct={tempPct.above}
                    mergedNote={mergedNote}
                  />

                  {/* 권역 온도 8행(#20) — 접힘 기본(헌장 ⑦). 구 스키마면 생략. */}
                  {zoneTemps && <ZoneTempRows zones={zoneTemps} />}
                </div>
              )}

              {/* 오늘 최다 공개 동네 — 지도 코너가 있으면 지도 아래 보조 줄로 이동(시안 B).
                  지도 없는 구 스키마에서만 기존 자리(헤드라인 블록)에 남는다. */}
              {busiestRegions.length > 0 && !regionCounts && (
                <BusiestLine busiestRegions={busiestRegions} isMerged={isMerged} />
              )}
            </>
          )}
        </div>

        {!isPrelaunch && (
          <>
            {/* ── [오늘의 거래 지도] — 수도권 82개 시군구 타일 격자(시안 B).
                농도 = 오늘 공개 건수, 링 = 강세·약세 발생, 타일 탭 = 동네면.
                구 스키마(regionCounts 없음)면 코너 생략. ── */}
            {regionCounts && (
              <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
                <CornerLabel>오늘의 거래 지도</CornerLabel>
                <TradeMap
                  regionCounts={regionCounts}
                  strongSet={strongMapSet}
                  weakSet={weakMapSet}
                />
                <TradeMapLegend />
                {/* 기존 "가장 많이 공개된 동네" 줄 — 지도 아래 보조로 유지. */}
                {busiestRegions.length > 0 && (
                  <BusiestLine busiestRegions={busiestRegions} isMerged={isMerged} />
                )}
                <CornerNote>
                  타일 = 수도권 82개 시군구(위치 근사) · 탭하면 동네면으로 ·{" "}
                  {isMerged ? "합산 기간" : "오늘"} 공개된 거래 기준{mergedNote}.
                </CornerNote>
                {/* 동네판 진입점(v2.6) — 지면에서 유일한 1개. #local 해시 → HomeTabs 가
                    동네판 탭으로 전환(구독 설정은 그쪽 지면에서).
                    박스형 버튼(사장 지시) — 코랄은 판정 CTA 전용이라 먹 아웃라인 위계. */}
                <a
                  href="#local"
                  className="mt-2.5 flex items-center justify-between border-2 px-3 py-2 text-[12.5px] font-bold"
                  style={{ borderColor: INK, color: INK, background: PAPER }}
                >
                  <span>우리동네 설정하기</span>
                  <span aria-hidden="true">→</span>
                </a>
              </section>
            )}

            {/* ── [회복률 지도] — 전고점 대비 회복률(v2.7 §3.2). 오늘의 거래 지도 아래,
                접힘(details) 기본. placeholder·수록 0곳이면 코너 자체 생략(graceful). ── */}
            {hasPeaks && (
              <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                    <span
                      className="inline-block px-2 py-[3px] text-[11px] font-bold tracking-[0.18em]"
                      style={{ background: INK, color: PAPER }}
                    >
                      회복률 지도 — 전고점 대비 회복률
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="text-[10px] tracking-[0.04em]"
                        style={{ color: INK_SOFT }}
                      >
                        bijigo.kr
                      </span>
                      <span
                        aria-hidden="true"
                        className="text-[11px] transition-transform duration-150 group-open:rotate-90"
                        style={{ color: INK_SOFT }}
                      >
                        ▸
                      </span>
                    </span>
                  </summary>
                  <div className="pt-2.5">
                    <RecoveryMap peaks={regionPeaks} />
                    <RecoveryLegend />
                    {recoveryTop5.length > 0 && <RecoveryTop5 top={recoveryTop5} />}
                    <CornerNote>
                      타일 = 수도권 82개 시군구(위치 근사) · 농도 = 전고점 대비 회복률 ·
                      탭하면 동네면 · 전고점은 천천히 움직임 — 주간 갱신.
                      <br />
                      국민평형(전용 84㎡급) 실거래 중위(3개월 이동) 기준 — 시세 지수 아님.
                      다른 평형은 회복 양상이 다를 수 있고, 개별 단지와도 다를 수 있음.
                    </CornerNote>
                  </div>
                </details>
              </section>
            )}

            {/* ── [월요 분석면] — 추격판(#19) + 격차 게이지(#10). 월요일 호 한정(헌장 ⑦),
                placeholder·보드 불성립이면 코너 자체 생략(graceful). ── */}
            {isMondayEdition && <ChaseCorner file={regionChase} />}

            {/* ── [주요 거래] — 오늘 공개된 수도권 15억 이상 전부 ── */}
            <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
              <CornerLabel>주요 거래</CornerLabel>
              {/* [주요 거래 최고 상승] 어그로 한 줄 — 구별 "최고" 직전 대비 상승(평균 아님 —
                  2건 평균은 무의미·사장 지적). 오보 게이트(직전 60일·이중 합의·≤30%) 통과분만
                  이라 "직전이 이상치라 뻥튀기된" 상승은 빠진다. 상승 구만 뜬다. */}
              {majorAgg.length > 0 && (
                <div className="mb-2">
                  <p className="m-0 text-[12px] leading-[1.6] tabular-nums" style={{ color: INK_SOFT }}>
                    <span className="mr-1 font-bold tracking-[0.04em]" style={{ color: INK }}>
                      오늘 최고 상승 · 직전 대비
                    </span>
                    {majorAgg.map((r, i) => (
                      <span key={r.sigungu}>
                        {i > 0 ? " · " : " "}
                        <b style={{ color: UP }}>
                          {shortRegion(r.sigungu)} +{pctAbs(r.topPct)}%
                        </b>
                      </span>
                    ))}
                  </p>
                  <p className="m-0 mt-0.5 text-[10px] leading-[1.5]" style={{ color: INK_SOFT }}>
                    각 구에서 오늘 나온 큰 거래(15억+)의 최고 상승 — 직전 실거래 대비, 오보 게이트 통과분. 구 전체 시세 아님.
                  </p>
                </div>
              )}
              {major === undefined ? (
                // 구 스키마(다음 크론 전) — 한 줄 예고로 처리.
                <CornerNote>「주요 거래」 코너는 다음 호부터 게재됩니다.</CornerNote>
              ) : major.length === 0 ? (
                <CornerNote>오늘 공개분엔 15억 이상 중개거래가 없었습니다.</CornerNote>
              ) : (
                <>
                  <div>
                    {majorVisible.map((item, i) => (
                      <div key={`${item.apt}-${item.dealDate}-${item.priceKrw}-${i}`}>
                        <DealDetails item={item}>
                          <MajorRow item={item} divider={i > 0} maxKrw={majorTopKrw} lateDays={lateDaysOf(item.dealDate)} />
                        </DealDetails>
                        {i === 0 && (
                          <div
                            className="mb-1 mt-0.5 border-l-2 pl-2 text-[11.5px] leading-[1.55]"
                            style={{ borderColor: RULE, color: INK_SOFT }}
                            title="가정: 월급 300 실수령, 한 푼 안 쓰고 전액 저축"
                          >
                            월급 300 기준{" "}
                            <b className="tabular-nums" style={{ color: INK }}>
                              {convYears}년
                            </b>{" "}
                            — 내 조건으론?{" "}
                            <a
                              href="#biji-verdict"
                              className="font-bold underline underline-offset-2"
                              style={{ color: CORAL }}
                            >
                              30초 판정 →
                            </a>{" "}
                            <span className="text-[9.5px]">(월 300 전액 저축 가정)</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {majorRest.length > 0 && (
                    <details className="mt-1">
                      <summary
                        className="cursor-pointer list-none py-1 text-[11.5px] font-bold"
                        style={{ color: INK_SOFT }}
                      >
                        전체 {major.length}건 펼치기 ▾
                      </summary>
                      <div className="border-t border-dotted" style={{ borderColor: RULE }}>
                        {majorRest.map((item, i) => (
                          <DealDetails
                            key={`${item.apt}-${item.dealDate}-${item.priceKrw}-r${i}`}
                            item={item}
                          >
                            <MajorRow item={item} divider={i > 0} maxKrw={majorTopKrw} lateDays={lateDaysOf(item.dealDate)} />
                          </DealDetails>
                        ))}
                      </div>
                    </details>
                  )}
                  <CornerNote>
                    {isMerged ? "합산 기간에" : "오늘"} 공개된 수도권 15억 이상 중개거래 전부 ·
                    직거래·해제 제외 · 가격 바 = {isMerged ? "합산" : "오늘"} 최고가 대비 ·
                    붉은 눈금 = 그 단지 기간(1년/2개월) 내 최고가 위치{mergedNote}.
                  </CornerNote>
                  {/* 원탭 공유 — 캡쳐 대신 클릭되는 링크카드(/s/major). 붙이면 큰 카드로
                      언펄되고 탭하면 비집고로 유입된다. 해석("강남 오르고 송파 내리네")은
                      퍼나르는 사람 몫 — 카드는 팩트만. */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <ShareButton
                      title="오늘의 주요 거래 — 비집고"
                      shareUrl="/s/major"
                      label="이 목록 공유"
                      ariaLabel="오늘의 주요 거래 카드 공유"
                    />
                    <span className="text-[10.5px]" style={{ color: INK_SOFT }}>
                      캡쳐 없이 — 오늘 큰 거래 TOP 7 카드로
                    </span>
                  </div>
                </>
              )}
            </section>

            {/* ── [강세 거래] — 직전 실거래(팩트)보다 높게 팔린 중개거래 실명 ── */}
            <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
              <CornerLabel>강세 거래</CornerLabel>
              {strongLegacy ? (
                <CornerNote>「강세 거래」 코너는 다음 호부터 직전 실거래 대비 기준으로 게재됩니다.</CornerNote>
              ) : strongs.length === 0 ? (
                <CornerNote>오늘 공개분엔 직전 거래보다 눈에 띄게 높게 팔린 중개거래가 없었습니다.</CornerNote>
              ) : (
                <>
                  <div>
                    {strongs.map((item, i) => (
                      <DealDetails key={`${item.kind}-${item.apt}-${item.dealDate}`} item={item}>
                        <StrongRow item={item} divider={i > 0} />
                      </DealDetails>
                    ))}
                  </div>
                  <CornerNote>
                    비교는 <b style={{ color: INK }}>같은 단지·평형의 최근 60일 내 직전 실거래</b>{" "}
                    기준 · 단지 최근 거래 기록과 대조해 선별 · {isMerged ? "합산" : "오늘"} 공개{" "}
                    {openCount.toLocaleString("ko-KR")}건 중{" "}
                    <b className="tabular-nums" style={{ color: INK }}>
                      {strongs.length}건
                    </b>{" "}
                    · 직거래·해제 제외{mergedNote}.
                  </CornerNote>
                  {/* 원탭 공유 — 클릭되는 강세 거래 링크카드(/s/major 미러). */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <ShareButton
                      title="오늘의 강세 거래 — 비집고"
                      shareUrl="/s/strong"
                      label="이 목록 공유"
                      ariaLabel="오늘의 강세 거래 카드 공유"
                    />
                    <span className="text-[10.5px]" style={{ color: INK_SOFT }}>
                      캡쳐 없이 — 강세 거래 카드로
                    </span>
                  </div>
                </>
              )}
            </section>

            {/* ── [약세 동네] — 시군구 집계만(특정 단지 실명 급락 게재 금지 — 2026-07-06 사장 지시).
                구 스키마(weakRegions 없음)·표본 없음이면 코너 자체를 조용히 생략. ── */}
            {weakRegions.length > 0 && (
              <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
                <CornerLabel>약세 동네</CornerLabel>
                <div>
                  {weakRegions.map((item, i) => (
                    <WeakRegionRow key={item.sigungu} item={item} divider={i > 0} />
                  ))}
                </div>
                <CornerNote>
                  {isMerged ? "합산 기간에" : "오늘"} 공개된 중개거래의 직전 실거래(같은
                  단지·평형, 최근 60일 내) 대비 평균 · 5건 이상 동네만{mergedNote}.
                </CornerNote>
                {/* 원탭 공유 — 클릭되는 약세 동네 링크카드. 시군구 집계만(단지 실명 없음). */}
                <div className="mt-2.5 flex items-center gap-2">
                  <ShareButton
                    title="오늘의 약세 동네 — 비집고"
                    shareUrl="/s/weak"
                    label="이 목록 공유"
                    ariaLabel="오늘의 약세 동네 카드 공유"
                  />
                  <span className="text-[10.5px]" style={{ color: INK_SOFT }}>
                    캡쳐 없이 — 약세 동네 카드로
                  </span>
                </div>
              </section>
            )}

            {/* ── [오늘의 해제] — 신고가-해제 감시. 국토부 공개 행정 사실만 인쇄, 사유
                단정 금지("조작" 류 단어 금지 — 편집 헌장). 0건·구 스키마면 코너 생략. ── */}
            {cancellations.length > 0 && (
              <section className="px-0.5 pb-3.5 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
                <CornerLabel>오늘 등록된 해제거래</CornerLabel>
                {/* 코너 설명 — "해제"가 뭔지 모르는 독자를 위한 1줄(2026-07-07 사장 지시). */}
                <p className="m-0 pb-1 text-[11px] leading-[1.55]" style={{ color: INK_SOFT }}>
                  계약 신고 후 취소(해제) 신고된 거래 — 국토부 공개 행정 사실이며 해제
                  사유는 공개되지 않습니다.
                </p>
                {/* 요약 줄 = 이 코너의 결론(항상 노출 — 무조작 완결, 헌장 6조).
                    wasTop 요약은 0건이면 공허한 문장이라 생략. 정렬은 현행 wasTop 우선 유지. */}
                <p className="m-0 text-[12.5px] leading-[1.6]" style={{ color: INK_SOFT }}>
                  {isMerged
                    ? `주말 합산 ${md(patch.mergedFromDate!)}~${md(patch.mergedToDate!)} 등록 해제거래`
                    : "오늘 등록된 해제거래"}{" "}
                  <b className="tabular-nums" style={{ color: INK }}>
                    {cancellations.length.toLocaleString("ko-KR")}건
                  </b>
                  {cancelWasTopCount > 0 && (
                    <>
                      {" "}
                      · 그중{" "}
                      <b className="tabular-nums" style={{ color: INK }}>
                        {cancelWasTopCount.toLocaleString("ko-KR")}건
                      </b>
                      은 해제 전까지 그 단지 최고가로 공개돼 있었음
                    </>
                  )}
                </p>
                {/* 행 리스트 — 기본 접힘(수십 건 나열이 지면을 늘림 — 헌장 7조 강등).
                    요약이 결론이므로 펼치지 않아도 완결. 네이티브 details — JS 0. */}
                <details className="mt-1">
                  <summary
                    className="cursor-pointer list-none py-1 text-[11.5px] font-bold"
                    style={{ color: INK_SOFT }}
                  >
                    전체 {cancellations.length.toLocaleString("ko-KR")}건 펼치기 ▾
                  </summary>
                  <div className="border-t border-dotted" style={{ borderColor: RULE }}>
                    {cancellations.map((item, i) => (
                      <CancellationRow
                        key={`${item.apt}-${item.dealDate}-${item.priceKrw}-${i}`}
                        item={item}
                        divider={i > 0}
                      />
                    ))}
                  </div>
                </details>
                <CornerNote>
                  계약 해제는 국토부 공개 행정 사실이며, 해제 사유는 알 수 없습니다 · 국토부는
                  신고가 신고 후 해제 행위를 별도 조사하고 있습니다{mergedNote}.
                </CornerNote>
              </section>
            )}
          </>
        )}

        {/* ── [내 문턱 · 구독자란] — 옵트인 로컬 프로필 있을 때만(클라이언트가 자체 렌더) ── */}
        <ThresholdGauge />

        {/* ── CTA — 코랄은 제호 플레이트와 CTA·판정 링크에만 ── */}
        <a
          href="#biji-verdict"
          className="mt-3 block w-full py-[13px] text-center text-[15px] font-extrabold tracking-[0.04em] text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2"
          style={{ background: CORAL, outlineColor: INK }}
        >
          그래서 이 동네들, 내 통장으론? — 30초 판정
        </a>

        {/* 홈 화면 앱 설치(A2HS) — 실제 설치 프롬프트/iOS 안내 (2026-07-11 사장). */}
        <div className="mt-2.5 flex justify-center">
          <InstallButton />
        </div>

        {/* ── 콜로폰 + 공유(콜로폰 옆 소형 버튼 — 각진 지면 톤) ── */}
        <div
          className="mt-3.5 flex items-start justify-between gap-3 pt-2.5 text-[10px] leading-[1.6]"
          style={{ borderTop: `2.5px solid ${INK}`, color: INK_SOFT }}
        >
          <span>
            국토부 실거래 공개분 기준 · 신고는 계약 후 최대 30일
            <br />
            실거래 기록 판독이며 투자 권유가 아닙니다 ·{" "}
            <a href="/principles" className="underline underline-offset-2">
              편집 원칙
            </a>
            {/* 정정 창구 — 명예훼손성 분쟁의 최전선 방어는 신속 정정 절차(2026-07-08). */}
            {" · "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[비집고] 지면 정정 요청")}`}
              className="underline underline-offset-2"
            >
              정정 요청
            </a>
          </span>
          <span className="flex shrink-0 items-center gap-2.5">
            <ShareButton title="비집고 — 오늘의 판" />
            <span className="text-right">
              다음 호
              <br />
              내일 아침
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
