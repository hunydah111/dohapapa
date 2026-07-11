"use client";

// 동네판 — 내 동네 브리핑 탭 (v2.6, "눈뜨고 3초").
//
// 구독자는 홈을 열면 이 지면이 기본 뷰로 즉시 뜬다(탭 전환·로그인·조작 0 — HomeTabs 담당).
// 첫 뷰포트(375px) 무스크롤 완결: ①[오늘 이 동네](공개 N건 + 주요·강세 행)
//   ②동네 등락 한 줄(직전 실거래 대비 평균 — 집계 문턱 미달이면 생략)
//   ③라이벌 미니보드({main} vs {rival} — 팩트 수치만: 기세 마크(최근 두 관측월 중위
//     변화)·우세 딱지(기세 큰 쪽·동률/결측 생략)·공개·최고가·직전 대비 평균(최근 며칠
//     합산 표본, 3건 미만은 "표본 부족"). 박스 전체가 동네면(/r) 링크. 평가 워딩 0).
// 이하: [최근 거래 상위] TOP5 → [12개월 추이] 요약+동네면 링크 → 30초 판정 CTA
//   → PWA 안내 1줄 → 콜로폰(출처 워터마크).
//
// 구독 = localStorage(biji-my-regions)뿐 — 서버 전송 0(무저장 원칙). 설정은 최초 1회가
// 전부, 이후엔 헤더 ⚙로만 변경. 미구독 = 콜드스타트: 오늘 최다 공개 동네 1곳의 브리핑을
// 예시로 통째 렌더 + "내 동네 고르기"(datalist 검색 셀렉트).
//
// 클라이언트 컴포넌트인 이유: 동네 선택이 기기에만 있다. 데이터는 서버(LocalFrontHost)가
// 전 시군구 압축분(localFront.buildLocalFrontData)으로 내려준다 — 여기선 briefFor 셀렉트만.
//
// 편집 헌장: 팩트만·기준점 병기·무조작 완결. 조판 토큰·명조·코랄 플레이트 문법은
// 1면(DailyFront)과 동일 — 코랄은 플레이트·CTA·판정 링크에만.

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { LAWD_CODES, SIGUNGU_NAMES, normalizeSigungu } from "@/lib/molit";
import {
  loadMyRegions,
  saveMyRegions,
  clearMyRegions,
  type MyRegions,
} from "@/lib/myRegions";
import {
  LOCAL_PULSE_MIN_SAMPLE,
  briefFor,
  pickColdStartSigungu,
  type LocalFrontData,
  type RegionBrief,
} from "@/lib/localFront";
import { ymdShortText } from "@/lib/patchNote";
import { areaMeta } from "@/lib/areaLabel";
import { ShareButton } from "./ShareButton";
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

// ── 포맷터 — 1면(DailyFront)·동네면(/r) 지면과 동일 규칙(그쪽은 파일 프라이빗이라 미러) ──
/** "2026-06-28" → "6/28". 깨진 값은 그대로. */
function md(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[1])}/${Number(m[2])}` : date;
}
/** "2026-06-18" → "'26.6.18" — 직전 비교 표기(연도 병기 의무, 1면과 단일 규칙). */
const ymdShort = ymdShortText;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
/** "2026-07-07" → "2026년 7월 7일 화요일". */
function koDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return date;
  const d = new Date(`${m[0].slice(0, 10)}T00:00:00Z`);
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일 ${WEEKDAYS[d.getUTCDay()]}요일`;
}
/** 원 → "18.5억" (.0 생략). */
function eok(krw: number): string {
  const v = krw / 100_000_000;
  const s = v.toFixed(1);
  return `${s.endsWith(".0") ? s.slice(0, -2) : s}억`;
}
// 면적 표기("84.7㎡ · 32~35평")는 공유 헬퍼(areaLabel.ts).
/** 등락률(소수) → "8.8" (절대값, .0 생략). */
function pctAbs(pct: number): string {
  const s = (Math.abs(pct) * 100).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}
/** "2025-07" → "25.7". */
function ymShort(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? `${m[1].slice(2)}.${Number(m[2])}` : ym;
}
/** "2021-10" → "'21.10" — 전고점 월 병기 전용(회복률 각주 헌장 — 기준월 의무). */
function ymApos(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? `'${m[1].slice(2)}.${Number(m[2])}` : ym;
}
/** 회복률(0~1+) → "92" (전고점 대비 %, 반올림 정수). 신고점 돌파는 100 이상. */
function recoveryPct(recovery: number): number {
  return Math.round(recovery * 100);
}
/** 전고점 대비 낙폭 → "8" (recovery 0.92 → 8%, 절대값 정수). 돌파(≥1)면 0 또는 +. */
function peakGapPct(recovery: number): number {
  return Math.round(Math.abs(1 - recovery) * 100);
}

// ── 조판 부품 (1면 미러 — 코너 라벨엔 출처 워터마크 의무) ─────────────────────────
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

/** [우리 동네 전고점 대비] 줄 — 내 동네 브리핑 최상단(눈뜨고 3초, 스펙 §3.1).
 *  "개포동(강남구) …" 대신 시군구 단위 데이터라 시군구명으로 표기 —
 *  "강남구 · '21.10 전고점 대비 −8% (회복 92% · 82곳 중 12위)" + trough 있으면 다음 줄
 *  "바닥('22.12) 대비 +34%". −X% 는 하락색 파랑(DOWN), 회복률은 상승색 빨강(UP).
 *  전고점=현재 돌파(recovery≥1)면 낙폭 대신 "신고점 회복". peak 없으면 호출부가 생략. */
function PeakLine({
  sigungu,
  peak,
}: {
  sigungu: string;
  peak: NonNullable<RegionBrief["peak"]>;
}) {
  const { entry, rank, total } = peak;
  const breached = entry.recovery >= 1;
  const gap = peakGapPct(entry.recovery);
  const rec = recoveryPct(entry.recovery);
  // 바닥 대비 반등률 — trough 있을 때만(같은 원 단위 계산, 정수 %).
  const reboundPct =
    entry.troughKrw != null && entry.troughKrw > 0
      ? Math.round(((entry.currentKrw - entry.troughKrw) / entry.troughKrw) * 100)
      : null;
  return (
    <div className="pb-2.5 tabular-nums">
      <p className="m-0 text-[12.5px] leading-[1.55]" style={{ color: INK_SOFT }}>
        <b style={{ color: INK }}>{sigungu}</b> · {ymApos(entry.peakYm)} 전고점 대비{" "}
        {breached ? (
          <b style={{ color: UP }}>{gap === 0 ? "회복 완료" : `+${gap}%`}</b>
        ) : (
          <b style={{ color: DOWN }}>−{gap}%</b>
        )}{" "}
        <span className="text-[11px]">
          (회복 <b style={{ color: UP }}>{rec}%</b> · {total.toLocaleString("ko-KR")}곳 중{" "}
          <b style={{ color: INK }}>{rank.toLocaleString("ko-KR")}위</b>)
        </span>
      </p>
      {reboundPct != null && entry.troughYm && (
        <p className="m-0 mt-0.5 text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
          바닥({ymApos(entry.troughYm)}) 대비{" "}
          <b style={{ color: reboundPct > 0 ? UP : reboundPct < 0 ? DOWN : INK }}>
            {reboundPct > 0 ? "+" : reboundPct < 0 ? "−" : "±"}
            {Math.abs(reboundPct)}%
          </b>
        </p>
      )}
    </div>
  );
}

// ── 구독 셀렉트 — 82개 시군구, 검색 가능한 datalist. 최초 1회 설정 + ⚙ 변경 공용. ────
const SIGUNGU_LIST = Object.keys(LAWD_CODES);
const DATALIST_ID = "biji-sigungu-options";

/** 입력값 → 시군구 풀네임(별칭 정규화 포함). 미지 값은 null. */
function resolveInput(raw: string): string | null {
  const v = normalizeSigungu(raw.trim());
  return SIGUNGU_NAMES.has(v) ? v : null;
}

function RegionField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  const invalid = value.trim() !== "" && resolveInput(value) === null;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold tracking-[0.08em]" style={{ color: INK_SOFT }}>
        {label}
      </span>
      <input
        list={DATALIST_ID}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border bg-white px-2.5 py-2 text-[13px] font-bold focus:outline-none"
        style={{ borderColor: invalid ? UP : INK, color: INK }}
      />
      {invalid ? (
        <span className="text-[10.5px]" style={{ color: UP }}>
          목록의 시군구명 그대로 골라 주세요 (예: 강남구, 수원시 팔달구)
        </span>
      ) : (
        hint && (
          <span className="text-[10.5px]" style={{ color: INK_SOFT }}>
            {hint}
          </span>
        )
      )}
    </label>
  );
}

function RegionPicker({
  initial,
  onSave,
  onClear,
  onCancel,
}: {
  initial: MyRegions | null;
  onSave: (regions: MyRegions) => void;
  /** 구독 중일 때만 — 해지 버튼. */
  onClear?: () => void;
  /** 구독 중 설정 패널일 때만 — 닫기. */
  onCancel?: () => void;
}) {
  const [main, setMain] = useState(initial?.main ?? "");
  const [rival, setRival] = useState(initial?.rival ?? "");
  const mainOk = resolveInput(main);
  const rivalRaw = rival.trim();
  const rivalOk = rivalRaw === "" ? undefined : resolveInput(rivalRaw);
  const sameRival = mainOk !== null && rivalOk != null && rivalOk === mainOk;
  const canSave = mainOk !== null && (rivalRaw === "" || (rivalOk != null && !sameRival));
  return (
    <div className="flex flex-col gap-2.5 border p-3" style={{ borderColor: INK, background: PAPER }}>
      <RegionField
        label="내 동네 (필수)"
        value={main}
        onChange={setMain}
        placeholder="시군구 검색 — 예: 강남구"
      />
      <RegionField
        label="라이벌 동네 (선택)"
        value={rival}
        onChange={setRival}
        placeholder="비교할 동네 — 비워도 됨"
        hint="고르면 두 동네를 매일 아침 나란히 비교"
      />
      {sameRival && (
        <p className="m-0 text-[10.5px]" style={{ color: UP }}>
          라이벌은 내 동네와 다른 동네로
        </p>
      )}
      <datalist id={DATALIST_ID}>
        {SIGUNGU_LIST.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <button
        type="button"
        disabled={!canSave}
        onClick={() => {
          if (!mainOk) return;
          onSave(rivalOk && !sameRival ? { main: mainOk, rival: rivalOk } : { main: mainOk });
        }}
        className="w-full py-2.5 text-center text-[13.5px] font-extrabold tracking-[0.04em] text-white disabled:opacity-40"
        style={{ background: CORAL }}
      >
        이 동네로 구독 — 내일 아침부터 열자마자
      </button>
      <p className="m-0 text-[10px] leading-[1.5]" style={{ color: INK_SOFT }}>
        이 폰에만 저장 · 서버 미전송 · 로그인 없음
      </p>
      {(onClear || onCancel) && (
        <div className="flex items-center justify-between">
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-bold underline underline-offset-2"
              style={{ color: INK_SOFT }}
            >
              구독 해지 (즉시 삭제)
            </button>
          ) : (
            <span />
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[11px] font-bold underline underline-offset-2"
              style={{ color: INK_SOFT }}
            >
              닫기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── 브리핑 행 — 1면·동네면 행 조판 문법 미러(점선 괘선·tabular-nums·가격 우측) ──────
function BriefRow({
  left,
  meta,
  right,
  sub,
  divider,
}: {
  left: React.ReactNode;
  meta?: string;
  right: React.ReactNode;
  sub?: React.ReactNode;
  divider: boolean;
}) {
  return (
    <div
      className={`py-[5.5px] tabular-nums ${divider ? "border-t border-dotted" : ""}`}
      style={divider ? { borderColor: RULE } : undefined}
    >
      <div className="flex items-baseline gap-2">
        {/* 단지명 = 세리프(나눔명조), 면적 메타는 Pretendard(프리미엄 하이브리드). */}
        <span className={`${serif.className} min-w-0 flex-1 truncate text-[14.5px]`} style={{ color: INK }}>
          {left}{" "}
          {meta && (
            <span className={`${pretendard.className} text-[11px]`} style={{ color: INK_SOFT }}>
              {meta}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right text-[13px] font-semibold" style={{ color: INK }}>
          {right}
        </span>
      </div>
      {sub && (
        <div className="mt-[1px] text-[11px] leading-[1.5]" style={{ color: INK_SOFT }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/** 라이벌 미니보드 열 1개 — 팩트 수치만(공개 건수·최고가·직전 대비 평균·회복률).
 *  박스 전체가 동네면(/r) 링크 — 점선 밑줄은 동네명에만(RegionLink 문법), 박스는 hover
 *  배경만. 평가 워딩 0.
 *  ※ 기세 마크(관측 중위 MoM ▲▼)·우세 딱지는 2026-07-08 폐지 — 평형 혼합 관측 중위의
 *    월간 변화는 거래 구성에 따라 출렁여(송파 −8.8% 사태, 사장 제보) 단독 숫자로 못 믿는다.
 *    "비교 기준은 단지 자기 시세"(7/6 교훈)와 동족 — 구성 왜곡 지표는 헤드라인 금지. */
function RivalColumn({
  brief,
  mine,
  recentDaysCount,
}: {
  brief: RegionBrief;
  /** 내 동네 열 — "내 동네" 라벨로만 구분. */
  mine: boolean;
  /** 직전 대비 평균 표본이 덮는 일수 — "최근 {N}일 · {M}건" 기준점 병기. */
  recentDaysCount: number;
}) {
  const rp = brief.recentPulse;
  const rpOk = rp !== null && rp.count >= LOCAL_PULSE_MIN_SAMPLE;
  const rpDir = !rpOk || rp.avgPct === 0 ? INK : rp.avgPct > 0 ? UP : DOWN;
  return (
    <a
      href={`/r/${encodeURIComponent(brief.sigungu)}`}
      title={`${brief.sigungu} 동네면`}
      className="flex min-w-0 flex-1 flex-col gap-1 p-2.5 no-underline transition-colors hover:bg-black/[0.04]"
      style={{ border: `1px solid ${INK}` }}
    >
      <p className="m-0 truncate text-[12.5px] font-extrabold" style={{ color: INK }}>
        <span className="underline decoration-dotted underline-offset-2">{brief.sigungu}</span>
        {mine && (
          <span className="ml-1 text-[9.5px] font-bold" style={{ color: INK_SOFT }}>
            내 동네
          </span>
        )}
      </p>
      <p className="m-0 text-[11px] leading-[1.55] tabular-nums" style={{ color: INK_SOFT }}>
        공개{" "}
        <b className="text-[13px]" style={{ color: INK }}>
          {brief.todayCount.toLocaleString("ko-KR")}건
        </b>
      </p>
      <p
        className="m-0 truncate text-[11px] leading-[1.55] tabular-nums"
        style={{ color: INK_SOFT }}
      >
        최고가{" "}
        {brief.todayMax ? (
          <>
            <b style={{ color: INK }}>{eok(brief.todayMax.priceKrw)}</b>
            <span className="text-[10px]">
              {" "}
              · {brief.todayMax.apt}
              {brief.todayMax.floor != null && ` ${brief.todayMax.floor}층`}
            </span>
          </>
        ) : (
          <span>—</span>
        )}
      </p>
      <p className="m-0 text-[11px] leading-[1.55] tabular-nums" style={{ color: INK_SOFT }}>
        {rpOk ? (
          <>
            직전 대비 평균{" "}
            <b style={{ color: rpDir }}>
              {rp.avgPct > 0 ? "+" : rp.avgPct < 0 ? "−" : "±"}
              {pctAbs(rp.avgPct)}%
            </b>
            <span className="block text-[9.5px]">
              최근 {recentDaysCount}일 · {rp.count.toLocaleString("ko-KR")}건
            </span>
          </>
        ) : (
          /* 내부용어("표본 부족") 금지(헌장 ③) — 왜 못 내는지 사람 말로. */
          <span className="text-[10.5px]">
            {(rp?.count ?? 0) === 0
              ? `최근 ${recentDaysCount}일 비교할 거래 없음`
              : `최근 ${recentDaysCount}일 ${rp!.count}건뿐 — 평균 내기엔 부족`}
          </span>
        )}
      </p>
      {/* 전고점 대비 회복률 1줄(v2.7) — 비교 강화. placeholder·미수록이면 생략.
          기준월 병기 의무(헌장): "회복 92%"만 쓰지 않고 전고점 월을 붙인다. */}
      {brief.peak && (
        <p className="m-0 text-[11px] leading-[1.55] tabular-nums" style={{ color: INK_SOFT }}>
          회복{" "}
          <b style={{ color: UP }}>{recoveryPct(brief.peak.entry.recovery)}%</b>
          <span className="block text-[9.5px]">
            {ymApos(brief.peak.entry.peakYm)} 전고점 대비
          </span>
        </p>
      )}
    </a>
  );
}

/** 동네 1곳의 브리핑 본문 — 구독 뷰·콜드스타트 예시가 같은 조판을 쓴다. */
function BriefBody({
  data,
  brief,
  rivalBrief,
  isMerged,
  mergedNote,
}: {
  data: LocalFrontData;
  brief: RegionBrief;
  rivalBrief: RegionBrief | null;
  isMerged: boolean;
  mergedNote: string;
}) {
  const when = isMerged ? "이번 합산" : "오늘";
  const pulse = brief.pulse;
  const pulseDir = pulse === null || pulse.avgPct === 0 ? INK : pulse.avgPct > 0 ? UP : DOWN;
  const majorRest = brief.majors.total - brief.majors.rows.length;
  const strongRest = brief.strongs.total - brief.strongs.rows.length;
  return (
    <>
      {/* ── ⓪ [우리 동네 전고점 대비] — 최상단 1줄(눈뜨고 3초). placeholder·미수록 생략. ── */}
      {brief.peak && (
        <div className="px-0.5 pt-3">
          <PeakLine sigungu={brief.sigungu} peak={brief.peak} />
        </div>
      )}

      {/* ── ① [오늘 이 동네] — 공개 건수 + 주요·강세 행 (첫 뷰포트 핵심) ── */}
      <section className="px-0.5 pb-3 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
        <CornerLabel>오늘 이 동네</CornerLabel>
        {brief.todayCount === 0 ? (
          <p className="m-0 text-[13px] leading-[1.6]" style={{ color: INK }}>
            <b>{when} 공개 없음</b>
            {brief.recentCount > 0 && (
              <span className="tabular-nums" style={{ color: INK_SOFT }}>
                {" "}
                · 최근 {data.recentDaysCount}일 {brief.recentCount.toLocaleString("ko-KR")}건
                공개
              </span>
            )}
          </p>
        ) : (
          <>
            <p className="m-0 text-[13px] leading-[1.6] tabular-nums" style={{ color: INK }}>
              {when} 공개{" "}
              <b className="text-[15px]">{brief.todayCount.toLocaleString("ko-KR")}건</b>
            </p>
            {/* ── ② 동네 등락 한 줄 — 직전 실거래 대비 평균(팩트). 문턱 미달이면 생략 ── */}
            {pulse && (
              <p className="m-0 mt-0.5 text-[12px] leading-[1.6] tabular-nums" style={{ color: INK_SOFT }}>
                직전 거래 대비 평균{" "}
                <b style={{ color: pulseDir }}>
                  {pulse.avgPct > 0 ? "+" : pulse.avgPct < 0 ? "−" : "±"}
                  {pctAbs(pulse.avgPct)}%
                </b>{" "}
                ({pulse.count}건 기준)
              </p>
            )}

            {brief.majors.rows.length > 0 && (
              <div className="pt-1.5">
                <p className="m-0 text-[11px] font-bold tracking-[0.08em]" style={{ color: INK_SOFT }}>
                  주요 거래(15억 이상 중개거래)
                </p>
                {brief.majors.rows.map((m, i) => (
                  <BriefRow
                    key={`m${m.apt}-${m.dealDate}-${m.priceKrw}-${i}`}
                    left={`${m.dong} ${m.apt}`}
                    meta={`${areaMeta(m.areaM2)}${m.floor != null ? ` · ${m.floor}층` : ""}`}
                    right={`${eok(m.priceKrw)} · 계약 ${md(m.dealDate)}`}
                    /* 서브라인 — 직전 실거래(사장 지시 7/8, 헌장 ②) + 기준점 최고가.
                       최고가 대비 %는 "정점과의 거리"라 방향색 금지(숫자만 먹),
                       직전 대비는 시세 방향 팩트라 방향색(UP/DOWN). */
                    sub={
                      m.prevKrw != null || (m.refMaxKrw != null && m.refMaxKrw > 0) ? (
                        <>
                          {m.prevKrw != null && m.pctVsPrev != null && (
                            <>
                              직전 {eok(m.prevKrw)}
                              {m.prevDate
                                ? ` (${ymdShort(m.prevDate)}${m.prevFloor != null ? `·${m.prevFloor}층` : ""})`
                                : ""}{" "}
                              대비{" "}
                              <b
                                style={{
                                  color:
                                    m.pctVsPrev > 0 ? UP : m.pctVsPrev < 0 ? DOWN : INK,
                                }}
                              >
                                {m.pctVsPrev > 0 ? "+" : m.pctVsPrev < 0 ? "−" : "±"}
                                {pctAbs(m.pctVsPrev)}%
                              </b>
                            </>
                          )}
                          {m.prevKrw != null && m.refMaxKrw != null && m.refMaxKrw > 0 && (
                            <br />
                          )}
                          {m.refMaxKrw != null && m.refMaxKrw > 0 && (
                            m.priceKrw > m.refMaxKrw ? (
                              <>
                                <b style={{ color: UP }}>
                                  — {m.refMaxPeriod} 내 최고가 갱신
                                </b>{" "}
                                (종전 {eok(m.refMaxKrw)})
                              </>
                            ) : m.priceKrw === m.refMaxKrw ? (
                              <b style={{ color: INK }}>— {m.refMaxPeriod} 내 최고가 동률</b>
                            ) : (
                              <>
                                최근 {m.refMaxPeriod} 최고 {eok(m.refMaxKrw)} (대비{" "}
                                <b style={{ color: INK }}>
                                  −{pctAbs((m.priceKrw - m.refMaxKrw) / m.refMaxKrw)}%
                                </b>
                                )
                              </>
                            )
                          )}
                        </>
                      ) : undefined
                    }
                    divider={i > 0}
                  />
                ))}
                {majorRest > 0 && (
                  <p className="m-0 text-[10.5px]" style={{ color: INK_SOFT }}>
                    외 {majorRest}건 —{" "}
                    <a
                      href={`/r/${encodeURIComponent(brief.sigungu)}`}
                      className="underline decoration-dotted underline-offset-2"
                      style={{ color: INK }}
                    >
                      동네면에서
                    </a>
                  </p>
                )}
              </div>
            )}

            {brief.strongs.rows.length > 0 && (
              <div className="pt-1.5">
                <p className="m-0 text-[11px] font-bold tracking-[0.08em]" style={{ color: INK_SOFT }}>
                  강세 거래(직전 실거래보다 높게)
                </p>
                {brief.strongs.rows.map((s, i) => (
                  <BriefRow
                    key={`s${s.apt}-${s.dealDate}-${i}`}
                    left={
                      <>
                        <span aria-hidden="true" className="mr-1 font-extrabold" style={{ color: UP }}>
                          ▲
                        </span>
                        {s.dong} {s.apt}
                      </>
                    }
                    meta={areaMeta(s.areaM2)}
                    right={
                      <span style={{ color: UP }}>+{pctAbs(s.pctVsPrev)}%</span>
                    }
                    sub={`직전 ${ymdShort(s.prevDate)} ${eok(s.prevKrw)}${s.prevFloor != null ? `(${s.prevFloor}층)` : ""} → ${eok(s.priceKrw)} · 계약 ${md(s.dealDate)}`}
                    divider={i > 0}
                  />
                ))}
                {strongRest > 0 && (
                  <p className="m-0 text-[10.5px]" style={{ color: INK_SOFT }}>
                    외 {strongRest}건 — 1면 [강세 거래]에서
                  </p>
                )}
              </div>
            )}

            {brief.majors.rows.length === 0 && brief.strongs.rows.length === 0 && (
              <p className="m-0 mt-1 text-[11.5px] leading-[1.55]" style={{ color: INK_SOFT }}>
                주요(15억 이상)·강세 게재 기준에 든 거래는 없었습니다 — 전체 목록은{" "}
                <a
                  href={`/r/${encodeURIComponent(brief.sigungu)}`}
                  className="underline decoration-dotted underline-offset-2"
                  style={{ color: INK }}
                >
                  동네면
                </a>
                에.
              </p>
            )}
          </>
        )}
        <CornerNote>
          {when} 공개된 이 동네 거래 기준 · 주요·강세는 직거래·해제 제외{mergedNote}.
        </CornerNote>
      </section>

      {/* ── ③ 라이벌 미니보드 — 팩트 수치만, 평가·서열 워딩 0(우세/기세만) ── */}
      {rivalBrief && (
        <section className="px-0.5 pb-3 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
          <CornerLabel>라이벌 보드</CornerLabel>
          <div className="flex gap-1.5">
            <RivalColumn brief={brief} mine recentDaysCount={data.recentDaysCount} />
            <RivalColumn
              brief={rivalBrief}
              mine={false}
              recentDaysCount={data.recentDaysCount}
            />
          </div>
          <CornerNote>
            {when} 공개분 팩트 비교 · 최고가는 중개거래(직거래·해제 제외) · 직전 대비
            평균은 최근 {data.recentDaysCount}일 공개 중개거래 중 직전 실거래(60일 내)
            있는 거래의 평균{mergedNote}.
          </CornerNote>
        </section>
      )}

      {/* ── [최근 거래 상위] — 동네면 TOP10의 발췌(TOP5) ── */}
      {brief.top && brief.top.items.length > 0 && (
        <section className="px-0.5 pb-3 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
          <CornerLabel>최근 거래 상위</CornerLabel>
          <p className="m-0 text-[11px] font-bold tracking-[0.08em]" style={{ color: INK_SOFT }}>
            <span
              className="mr-1.5 inline-block border px-1.5 py-[1px] text-[10.5px]"
              style={{ borderColor: INK, color: INK }}
            >
              {brief.top.bandLabel}
            </span>
            최근 60일 관측 {brief.top.deals.toLocaleString("ko-KR")}건 중 상위{" "}
            {brief.top.items.length}
          </p>
          {brief.top.items.map((it, i) => {
            const pct =
              it.prevKrw != null && it.prevKrw > 0
                ? (it.priceKrw - it.prevKrw) / it.prevKrw
                : null;
            return (
              <BriefRow
                key={`t${it.apt}-${it.dealDate}-${it.priceKrw}`}
                left={`${i + 1}. ${it.dong} ${it.apt}`}
                meta={`${areaMeta(it.areaM2)}${it.floor != null ? ` · ${it.floor}층` : ""}`}
                right={`${eok(it.priceKrw)} · 계약 ${md(it.dealDate)}`}
                sub={
                  pct != null && it.prevDate != null && it.prevKrw != null
                    ? `직전 ${ymdShort(it.prevDate)} ${eok(it.prevKrw)} 대비 ${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${pctAbs(pct)}%`
                    : undefined
                }
                divider={i > 0}
              />
            );
          })}
          {/* 인라인 방향색 — sub는 문자열이라 여기서 못 칠함. 방향색은 위 12개월·강세에만.
              (sub 등락 색까지 필요해지면 BriefRow sub를 노드로 확장 — v1은 절제) */}
          <CornerNote>
            최근 60일 공개 중개거래(해제·직거래 제외) · 단지당 대표 1건 · 가격순 —
            시세가 아닌 관측값 · 전체 TOP10은 동네면에.
          </CornerNote>
        </section>
      )}

      {/* ── [12개월 추이] 요약 — 차트는 동네면에, 여기선 한 줄 + 링크 ── */}
      <section className="px-0.5 pb-3 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
        <CornerLabel>12개월 추이</CornerLabel>
        {brief.seriesSummary ? (
          <p className="m-0 text-[12.5px] leading-[1.6] tabular-nums" style={{ color: INK_SOFT }}>
            관측 중위 <b style={{ color: INK }}>{eok(brief.seriesSummary.firstKrw)}</b> →{" "}
            <b style={{ color: INK }}>{eok(brief.seriesSummary.lastKrw)}</b>{" "}
            <b
              style={{
                color:
                  brief.seriesSummary.pct === 0
                    ? INK
                    : brief.seriesSummary.pct > 0
                      ? UP
                      : DOWN,
              }}
            >
              ({brief.seriesSummary.pct > 0 ? "+" : brief.seriesSummary.pct < 0 ? "−" : "±"}
              {pctAbs(brief.seriesSummary.pct)}%)
            </b>{" "}
            · 거래 최다 {ymShort(brief.seriesSummary.busiestYm)}(
            {brief.seriesSummary.busiestCount.toLocaleString("ko-KR")}건)
          </p>
        ) : (
          <p className="m-0 text-[12px] leading-[1.6]" style={{ color: INK_SOFT }}>
            추이 요약은 주간 갱신부터 채워집니다.
          </p>
        )}
        <p className="m-0 mt-1.5">
          <a
            href={`/r/${encodeURIComponent(brief.sigungu)}`}
            className="text-[12.5px] font-bold underline underline-offset-2"
            style={{ color: INK }}
          >
            {brief.sigungu} 동네면 전체 보기 →
          </a>
        </p>
        <CornerNote>
          국토부 실거래 관측값(해제·직거래 제외, 평형 혼합 중위) — 시세 지수가 아닙니다.
        </CornerNote>
      </section>
    </>
  );
}

/** 판정 CTA + PWA 안내 + 콜로폰 — 지면 하단 공통부(1면 문법 미러). */
function SheetFooter({ shareTitle }: { shareTitle: string }) {
  return (
    <>
      <a
        href="#biji-verdict"
        className="mt-3 block w-full py-[13px] text-center text-[15px] font-extrabold tracking-[0.04em] text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2"
        style={{ background: CORAL, outlineColor: INK }}
      >
        이 동네, 내 통장으론? — 30초 판정
      </a>


      <div
        className="mt-3 flex items-start justify-between gap-3 pt-2.5 text-[10px] leading-[1.6]"
        style={{ borderTop: `2.5px solid ${INK}`, color: INK_SOFT }}
      >
        <span>
          국토부 실거래 공개분 기준 · 신고는 계약 후 최대 30일
          <br />
          실거래 기록 판독이며 투자 권유가 아닙니다
        </span>
        <span className="flex shrink-0 items-center gap-2.5">
          <ShareButton title={shareTitle} />
          <span className="text-right">
            다음 호
            <br />
            내일 아침
          </span>
        </span>
      </div>
    </>
  );
}

export function LocalFront({ data }: { data: LocalFrontData }) {
  const [regions, setRegions] = useState<MyRegions | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // localStorage 는 클라이언트 전용 — hydration 불일치 방지 위해 마운트 후 로드.
  useEffect(() => {
    const saved = loadMyRegions();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부(localStorage) 동기화
    setRegions(saved);
    track("local_front_view", { subscribed: saved !== null });
  }, []);

  const handleSave = (r: MyRegions) => {
    saveMyRegions(r);
    setRegions(loadMyRegions()); // 저장 실패(프라이빗 모드)여도 화면은 실제 저장 상태를 따른다
    setSettingsOpen(false);
    track("local_front_subscribe", { has_rival: !!r.rival });
    window.scrollTo({ top: 0 });
  };
  const handleClear = () => {
    clearMyRegions();
    setRegions(null);
    setSettingsOpen(false);
  };

  const isPrelaunch = data.generatedAt === null;
  const isMerged =
    data.mode === "merged" && !!data.mergedFromDate && !!data.mergedToDate;
  const mergedNote = isMerged
    ? ` · 주말 합산 ${md(data.mergedFromDate!)}~${md(data.mergedToDate!)} 공개분`
    : "";

  const main = regions?.main ?? null;
  const exampleSigungu = main === null ? pickColdStartSigungu(data) : null;
  const focusSigungu = main ?? exampleSigungu;
  const brief = focusSigungu ? briefFor(data, focusSigungu) : null;
  const rivalBrief = main && regions?.rival ? briefFor(data, regions.rival) : null;

  return (
    <section className="mx-auto mb-4 w-full max-w-md">
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
            {isPrelaunch ? "창간 준비호" : koDate(data.generatedAt!)}
            {isMerged && (
              <>
                {" "}
                · 주말 합산 {md(data.mergedFromDate!)}~{md(data.mergedToDate!)} 공개분
              </>
            )}
          </span>
          <span>동네판 · 매일 아침 발행</span>
        </div>

        {/* ── 제호 — 코랄 플레이트 미니 + 동적 "{동네}판" (명조) + ⚙ ── */}
        <header
          className="flex items-center justify-between gap-2 px-0.5 pb-2.5 pt-3"
          style={{ borderTop: `2.5px solid ${INK}`, borderBottom: `1px solid ${INK}` }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`${pretendard.className} inline-block shrink-0 px-2 py-1 text-[17px] font-bold leading-none tracking-[0.06em]`}
              style={{ background: CORAL, color: PAPER }}
            >
              비집고
            </span>
            <h2
              className={`${serif.className} m-0 min-w-0 truncate text-[25px] leading-[1.25] break-keep`}
            >
              {main ?? "내 동네"}
              <span className="text-[17px]">판</span>
            </h2>
          </div>
          {main && (
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-label="동네판 설정 — 동네 변경·해지"
              aria-expanded={settingsOpen}
              className="shrink-0 border px-2 py-1 text-[13px] leading-none"
              style={{ borderColor: INK, color: INK, background: PAPER }}
            >
              ⚙
            </button>
          )}
        </header>

        {/* ── 구독 설정 패널 (⚙) — 설정은 최초 1회가 전부, 이후 여기서만 변경 ── */}
        {main && settingsOpen && (
          <div className="pt-3">
            <RegionPicker
              initial={regions}
              onSave={handleSave}
              onClear={handleClear}
              onCancel={() => setSettingsOpen(false)}
            />
          </div>
        )}

        {main === null ? (
          /* ── 콜드스타트 — 내 동네 고르기 + 오늘 최다 공개 동네 예시 지면 ── */
          <>
            <div className="px-0.5 pb-3 pt-3" style={{ borderBottom: `1px solid ${RULE}` }}>
              <p className="m-0 pb-2 text-[13px] leading-[1.6]" style={{ color: INK }}>
                <b>내 동네를 고르면 — 아침에 열자마자 이 지면이 먼저 뜹니다.</b>{" "}
                <span style={{ color: INK_SOFT }}>
                  오늘 거래·등락·라이벌 비교까지 스크롤 없이 한 판.
                </span>
              </p>
              <RegionPicker initial={null} onSave={handleSave} />
            </div>

            {brief && !isPrelaunch && (
              <>
                <div className="px-0.5 pt-3">
                  <p className="m-0 text-[11px] font-bold tracking-[0.1em]" style={{ color: INK_SOFT }}>
                    예시 지면 — {isMerged ? "이번 합산" : "오늘"} 최다 공개 동네{" "}
                    <b style={{ color: INK }}>{brief.sigungu}</b>
                  </p>
                </div>
                <BriefBody
                  data={data}
                  brief={brief}
                  rivalBrief={null}
                  isMerged={isMerged}
                  mergedNote={mergedNote}
                />
              </>
            )}
            {isPrelaunch && (
              <p className="m-0 px-0.5 pt-3 text-[12.5px] leading-[1.6]" style={{ color: INK_SOFT }}>
                첫 지면은 곧 발행됩니다 — 구독해 두면 발행일 아침부터 내 동네가 먼저 떠요.
              </p>
            )}
          </>
        ) : (
          /* ── 구독 뷰 — 눈뜨고 3초: ①오늘 이 동네 ②등락 ③라이벌 보드 ── */
          brief && (
            <BriefBody
              data={data}
              brief={brief}
              rivalBrief={rivalBrief}
              isMerged={isMerged}
              mergedNote={mergedNote}
            />
          )
        )}

        <SheetFooter shareTitle={`비집고 — ${main ?? "내 동네"}판`} />
      </div>
    </section>
  );
}
