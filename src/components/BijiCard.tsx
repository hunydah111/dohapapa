"use client";

import { useEffect, useState } from "react";
import type { BudgetTier, BijiOrnament } from "@/lib/budgetPercentile";
import { pickTierImage } from "@/lib/budgetPercentile";
import { composeBijiName } from "@/lib/bijiName";
import { SITE_DOMAIN } from "@/lib/site";

// 비지 트레이딩 카드 — 등급 1마리 + 합성 이름 + 동네·평형 + 라이프스타일 칩 + 워터마크.
// 등급별 배경/장식은 tier.theme(budgetPercentile.ts) 가 진실. 비지 자세·소품이 6마리 모두
// 달라도 카드 자체가 등급 무드를 살려주면 "같은 시리즈"로 보임. (C방향)
//
// 박스 비율: 5:7 (포커 카드). 상단 65%는 비지 영역(bottom 정렬), 하단 35%는 텍스트.
// 비지 영역에 상단 ~18% 헤더 여백 — 머리 위 데코(별·불꽃·음표·하트)가 잘리지 않게.

// 카드 모서리에 등급별 미세 장식. pointer-events none. 본체(비지)는 안 가림.
function Ornament({ kind, accent }: { kind: BijiOrnament; accent: string }) {
  // z-10 — 비지 이미지(흰 polaroid)가 SVG를 가리는 문제 해소. 별·하트·음표 등 corner deco가
  // 비지 위에 떠보이게 (Freddie 머리 옆 별빛 같은 floating decoration).
  const common = "pointer-events-none absolute inset-0 h-full w-full z-10";
  switch (kind) {
    case "gold-stars":
      // queen — 무대 스포트라이트 큰 별 + 작은 반짝
      return (
        <svg aria-hidden="true" viewBox="0 0 320 224" preserveAspectRatio="xMidYMid slice" className={common}>
          <g fill={accent}>
            <path d="M44 30 l4 9 l9 2 l-6.5 6.5 l2 9 l-8.5 -4.5 l-8.5 4.5 l2 -9 l-6.5 -6.5 l9 -2 z" opacity="0.85" />
            <path d="M286 24 l3 7 l7 1.5 l-5 5 l1.5 7 l-6.5 -3.5 l-6.5 3.5 l1.5 -7 l-5 -5 l7 -1.5 z" opacity="0.8" />
            <circle cx="266" cy="92" r="2.4" opacity="0.7" />
            <circle cx="58" cy="120" r="2" opacity="0.55" />
            <circle cx="298" cy="170" r="1.8" opacity="0.6" />
          </g>
        </svg>
      );
    case "stars":
      // (legacy/예비) — 골드 별 흩뿌림
      return (
        <svg aria-hidden="true" viewBox="0 0 320 224" preserveAspectRatio="xMidYMid slice" className={common}>
          <g fill={accent}>
            <path d="M48 38 l2.5 5.5 l6 1 l-4.5 4 l1 6 l-5 -2.5 l-5 2.5 l1 -6 l-4.5 -4 l6 -1 z" opacity="0.7" />
            <path d="M276 32 l2 4.5 l5 0.8 l-3.5 3.2 l0.8 5 l-4.3 -2.2 l-4.3 2.2 l0.8 -5 l-3.5 -3.2 l5 -0.8 z" opacity="0.65" />
            <circle cx="290" cy="110" r="1.8" opacity="0.55" />
            <circle cx="42" cy="155" r="2" opacity="0.5" />
          </g>
        </svg>
      );
    case "flames":
      // rain — noir 점 (따뜻한 골드 점)
      return (
        <svg aria-hidden="true" viewBox="0 0 320 224" preserveAspectRatio="xMidYMid slice" className={common}>
          <g fill={accent}>
            <circle cx="40" cy="40" r="3" opacity="0.5" />
            <circle cx="290" cy="32" r="2.5" opacity="0.55" />
            <circle cx="60" cy="170" r="2" opacity="0.45" />
            <circle cx="280" cy="180" r="3" opacity="0.5" />
            <circle cx="306" cy="100" r="2" opacity="0.4" />
          </g>
        </svg>
      );
    case "notes":
      // (legacy/예비) — 음표 (엘비스)
      return (
        <svg aria-hidden="true" viewBox="0 0 320 224" preserveAspectRatio="xMidYMid slice" className={common}>
          <g fill={accent} opacity="0.85">
            {/* 큰 음표 1 */}
            <g transform="translate(34 28)">
              <ellipse cx="0" cy="14" rx="7" ry="5.5" transform="rotate(-18 0 14)" />
              <rect x="5.5" y="-18" width="2.5" height="30" />
              <path d="M8 -18 q14 4 10 18" stroke={accent} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>
            {/* 큰 음표 2 */}
            <g transform="translate(282 50)" opacity="0.75">
              <ellipse cx="0" cy="10" rx="5" ry="4" transform="rotate(-18 0 10)" />
              <rect x="3.5" y="-14" width="2" height="24" />
              <path d="M5.5 -14 q10 2 8 12" stroke={accent} strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>
            <circle cx="64" cy="170" r="2.5" opacity="0.5" />
            <circle cx="296" cy="180" r="2.5" opacity="0.5" />
          </g>
        </svg>
      );
    case "confetti":
      // gukmin — 따뜻한 점 흩뿌림
      return (
        <svg aria-hidden="true" viewBox="0 0 320 224" preserveAspectRatio="xMidYMid slice" className={common}>
          <g fill={accent}>
            <circle cx="42" cy="46" r="2.5" opacity="0.45" />
            <circle cx="286" cy="38" r="2" opacity="0.5" />
            <circle cx="60" cy="180" r="2" opacity="0.4" />
            <circle cx="288" cy="172" r="2.5" opacity="0.45" />
            <rect x="262" y="100" width="4" height="4" transform="rotate(20 264 102)" opacity="0.4" />
            <rect x="48" y="118" width="4" height="4" transform="rotate(-15 50 120)" opacity="0.4" />
          </g>
        </svg>
      );
    case "hearts":
      // bieber/baby — 작은 하트 (teen heartthrob / 아기)
      return (
        <svg aria-hidden="true" viewBox="0 0 320 224" preserveAspectRatio="xMidYMid slice" className={common}>
          <g fill={accent} opacity="0.55">
            <path d="M48 38 c-2 -3 -7 -3 -7 1 c0 4 7 8 7 8 s7 -4 7 -8 c0 -4 -5 -4 -7 -1 z" />
            <path d="M284 30 c-1.6 -2.4 -5.6 -2.4 -5.6 0.8 c0 3.2 5.6 6.4 5.6 6.4 s5.6 -3.2 5.6 -6.4 c0 -3.2 -4 -3.2 -5.6 -0.8 z" opacity="0.5" />
            <path d="M62 165 c-1.4 -2.1 -4.9 -2.1 -4.9 0.7 c0 2.8 4.9 5.6 4.9 5.6 s4.9 -2.8 4.9 -5.6 c0 -2.8 -3.5 -2.8 -4.9 -0.7 z" opacity="0.5" />
          </g>
        </svg>
      );
    default:
      return null;
  }
}

export interface BijiCardProps {
  /** 등급 정보 (이미지·테마 포함). */
  tier: BudgetTier;
  /** 시군구 — 합성 이름·표시용. 없으면 라벨로 폴백(국민·아기 등급은 항상 라벨). */
  sigungu?: string | null;
  /** 동(읍·면) 이름. 표시용 — 없으면 시군구만. */
  dongName?: string | null;
  /** 평형(전용 ㎡). */
  areaM2?: number | null;
  /** 라이프스타일 칩(최대 3개 권장) — 예: ["🏫 초품아", "🌊 한강변", "🚗 자차 25분"]. */
  chips?: string[];
  /**
   * D-day 메인 숫자 — "한 방" 카드의 심장. headline 예: "D-2,847" / "지금 입성 가능" / "D-아득".
   * caption 예: "마포구 중위 입성까지". 있으면 비지 영역이 살짝 줄어 텍스트 영역이 커진다.
   */
  dday?: { headline: string; caption: string };
  /** 카드 폭을 부모 max-w로 끌어쓰기 — 기본 max-w-sm. */
  className?: string;
  /** 첫 등장 모션. 기본 true. */
  popIn?: boolean;
}

// 등급별 본문 텍스트/카피 색. 동적 hex는 인라인 style로(여기서는 light/dark 두 리터럴만).
function textColors(tier: BudgetTier) {
  const light = tier.theme.textTone === "light";
  return {
    primary: light ? "text-white" : "text-[#3a2c1d]",
    secondary: light ? "text-white/85" : "text-[#6e5b46]",
    muted: light ? "text-white/65" : "text-[#9c8a72]",
    divider: light ? "border-white/20" : "border-[rgba(70,48,24,0.12)]",
    chipBg: light ? "bg-white/15 text-white" : "bg-[rgba(70,48,24,0.08)] text-[#3a2c1d]",
  };
}

export function BijiCard({
  tier,
  sigungu,
  dongName,
  areaM2,
  chips,
  dday,
  className = "",
  popIn = true,
}: BijiCardProps) {
  const colors = textColors(tier);
  const name = composeBijiName(sigungu ?? null, tier);
  const meta = [sigungu, dongName, areaM2 ? `전용 ${areaM2}㎡` : null].filter(Boolean).join(" · ");
  // 시군구 시드 결정적 초기값 — 동일 지역은 항상 같은 변주 (SSR/CSR 일치).
  // 사용자가 비지 탭하면 array의 다음 변주로 사이클 (이스터에그).
  const imageList = Array.isArray(tier.image) ? tier.image : null;
  const [imageIndex, setImageIndex] = useState(() => {
    if (!imageList) return 0;
    const initial = pickTierImage(tier.image, sigungu ?? null);
    const idx = imageList.indexOf(initial);
    return idx >= 0 ? idx : 0;
  });
  const imageUrl = imageList ? imageList[imageIndex] : (tier.image as string);
  const canCycle = imageList !== null && imageList.length > 1;

  // 변주 preload — array 등급은 mount 후 ~2.5초 deferred fetch.
  // 첫 paint 우선·모바일 3G 통신비 부담 ↓. 화질 동일 (같은 HD 이미지 미리 받아둠).
  // 사용자가 탭하기 전에 충분히 적재됨 — 보통 탭은 결과 보고 몇 초 후라 자연스러움.
  useEffect(() => {
    if (!imageList) return;
    const handle = window.setTimeout(() => {
      imageList.forEach((url) => {
        const img = new globalThis.Image();
        img.src = `${url}?v=4`;
      });
    }, 2500);
    return () => window.clearTimeout(handle);
  }, [imageList]);

  // 단일 이미지 등급(queen/rain/bieber)의 탭 반응 — key 재마운트로 애니메이션 재생.
  const [tapCount, setTapCount] = useState(0);
  const tapAnim = !canCycle ? tier.theme.tapAnimation : undefined;
  const handleSingleTap = tapAnim ? () => setTapCount((c) => c + 1) : undefined;

  // 처음 보는 비지 발견 알림 — array cycle 시 본 적 없는 변주면 ✨ toast (2.5s).
  // localStorage "biji-seen-variants" 에 URL 누적 (최대 50개), 모든 array 등급 공용.
  const [discovered, setDiscovered] = useState(false);
  const SEEN_KEY = "biji-seen-variants";
  // 마운트 시 초기 변주를 seen 목록에 추가 (첫 화면 비지는 "본" 것으로 간주, cycle 시 알림 X).
  useEffect(() => {
    if (!imageList) return;
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      const seen: string[] = raw ? JSON.parse(raw) : [];
      const initialUrl = imageList[imageIndex];
      if (!seen.includes(initialUrl)) {
        seen.push(initialUrl);
        localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-50)));
      }
    } catch {
      /* localStorage 비활성 (시크릿 모드 등) — 조용히 무시 */
    }
    // 초기값만 한 번 — imageIndex deps 제외 (cycle 시는 handleCycle 안에서 처리)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageList]);
  // 발견 알림 자동 사라짐
  useEffect(() => {
    if (!discovered) return;
    const t = window.setTimeout(() => setDiscovered(false), 2500);
    return () => window.clearTimeout(t);
  }, [discovered]);

  // canCycle 케이스에 발견 체크 추가 — handleCycle 재정의
  const handleCycleWithDiscovery = canCycle
    ? () => {
        const nextIdx = (imageIndex + 1) % imageList.length;
        const nextUrl = imageList[nextIdx];
        try {
          const raw = localStorage.getItem(SEEN_KEY);
          const seen: string[] = raw ? JSON.parse(raw) : [];
          if (!seen.includes(nextUrl)) {
            seen.push(nextUrl);
            localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-50)));
            setDiscovered(true);
          }
        } catch {
          /* localStorage 비활성 시 발견 알림만 skip */
        }
        setImageIndex(nextIdx);
      }
    : undefined;

  const handleTap = handleCycleWithDiscovery ?? handleSingleTap;
  const imgKey = canCycle ? `cycle-${imageIndex}` : `tap-${tapCount}`;
  const imgInteractive = handleTap !== undefined;

  return (
    <section
      className={`relative overflow-hidden rounded-3xl shadow-card ${popIn ? "biji-pop-in" : ""} ${className}`}
      style={{ background: tier.theme.cardBg, aspectRatio: "5 / 7" }}
      aria-label={`${name} 트레이딩 카드`}
    >
      {/* 코너 글로우 — 등급별 무드. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: tier.theme.glow }} />

      {/* 처음 보는 비지 발견 알림 — array cycle 시 본 적 없는 변주면 ✨ toast (2.5s 후 fade). */}
      {discovered && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-amber-300 px-3 py-1 text-[10.5px] font-extrabold text-coral-800 shadow-lg biji-pop-in">
          ✨ 처음 보는 비지!
        </div>
      )}

      {/* 비지 영역 (상단 65% — D-day 있으면 57%로 양보) — 흰 배경 박스 (Polaroid 풍). */}
      <div className={`absolute inset-x-0 top-0 ${dday ? "h-[57%]" : "h-[65%]"} overflow-hidden bg-white`}>
        <Ornament kind={tier.theme.ornament} accent={tier.theme.accent} />

        {/* 등급 라벨 캡 — 상단 우측. 흰 배경 위라 textTone 무관하게 다크 칩 고정. */}
        <div className="absolute right-4 top-3 z-10">
          <span className="inline-flex items-center rounded-full bg-[rgba(70,48,24,0.08)] px-2.5 py-1 text-[11px] font-bold text-[#3a2c1d] backdrop-blur-sm">
            {tier.label}
          </span>
        </div>

        {/* 비지 — 카드 영역 풀로 채움. 이스터에그:
            - array 변주(baby·gukmin): 탭하면 다음 변주로 사이클 (biji-pop-in 재트리거)
            - 단일 등급(queen/rain/bieber): 탭하면 tapAnimation 재생 (콧수염 흔들·반짝·헤어 휘날림)
            key 변화로 매 탭마다 애니메이션 재트리거. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={imgKey}
          src={`${imageUrl}?v=4`}
          alt={`${tier.label} 비지`}
          onClick={handleTap}
          className={`${canCycle ? "biji-pop-in" : tapAnim ?? ""} absolute inset-0 h-full w-full select-none ${imgInteractive ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
          style={{ objectFit: "contain" }}
          draggable={false}
        />
      </div>

      {/* 텍스트 영역 (하단 35% — D-day 있으면 43%) */}
      <div className={`absolute inset-x-0 bottom-0 flex ${dday ? "h-[43%]" : "h-[35%]"} flex-col justify-between px-4 pb-3 pt-2.5`}>
        {/* 합성 이름 — 길이별 fontSize 자동(자연어 형태라 "강남 저스틴비버" 8자도 가능). */}
        <div className="min-w-0">
          <h3
            className={`font-jua leading-[1.05] ${colors.primary} truncate`}
            style={{
              fontSize: name.length >= 8 ? "1.2rem" : name.length >= 6 ? "1.45rem" : "1.75rem",
              color: tier.theme.nameColor ?? (tier.theme.textTone === "dark" ? tier.theme.accent : undefined),
            }}
            title={name}
          >
            {name}
          </h3>
          {meta && (
            <p className={`mt-0.5 text-[11.5px] ${colors.secondary} truncate`} title={meta}>
              {meta}
            </p>
          )}
        </div>

        {/* D-day — 카드의 심장. 캡션(어디까지) + 메인 숫자(Jua 영웅화). 캡처 단위 완성. */}
        {dday && (
          <div className="mt-1 min-w-0">
            <p className={`text-[10px] font-semibold ${colors.muted} truncate`}>
              {dday.caption}
            </p>
            <p
              className="font-jua leading-none tracking-tight"
              style={{
                fontSize: dday.headline.length >= 8 ? "1.35rem" : "1.7rem",
                color: tier.theme.nameColor ?? tier.theme.accent,
              }}
            >
              {dday.headline}
            </p>
          </div>
        )}

        {/* 라이프스타일 칩 — 최대 2개 (D-day 있으면 1개로 양보). */}
        {chips && chips.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {chips.slice(0, dday ? 1 : 2).map((chip, i) => (
              <span
                key={i}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.chipBg}`}
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* 워터마크 — 캡쳐 공유 시 출처 동행. */}
        <div className={`mt-1.5 flex items-center gap-1 border-t ${colors.divider} pt-1.5`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/biji/biji-face.png?v=2"
            alt=""
            width={12}
            height={12}
            className="h-3 w-3"
            draggable={false}
          />
          <span className={`text-[10.5px] font-extrabold tracking-tight ${colors.primary}`}>비집고</span>
          <span className={`ml-auto text-[9.5px] font-semibold ${colors.muted} truncate`}>{SITE_DOMAIN}</span>
        </div>
      </div>
    </section>
  );
}
