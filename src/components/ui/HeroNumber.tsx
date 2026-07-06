// 토스 패턴 + 비집고 시그니처 — 핵심 수치(D-day·가격·잔액)를 영웅화.
// 한 페이지에 1-2회만 사용 권장. 작은 수치는 본문 그대로.
//
// 사용 예:
//   <HeroNumber value="5억 2,400만" caption="추정 현재가" tone="gold" />
//   <HeroNumber value="D−3년 2개월" caption="지금 페이스 · 보합 가정" tone="accent" />
//
// font 기본은 'jua' — 비집고 "손글씨 같은 따뜻한 금융 도구" 시그니처
// (토스/당근의 모던 산세리프와 차별화).

import type { ReactNode } from "react";

type Tone = "ink" | "accent" | "subtle" | "gold";

const TONE_COLOR: Record<Tone, string> = {
  ink: "#191713",      // 진한 우드 브라운 (기본 본문 톤)
  accent: "#e8571f",   // 코랄 (강한 강조 — D-day 등)
  subtle: "#5d574c",   // 부드러운 우디 (보조)
  gold: "#191713",     // 깊은 페일 골드 — 핵심 가격·금액 (당근에 없는 황토 시그니처)
};

export function HeroNumber({
  value,
  caption,
  tone = "ink",
  size = "display",
  align = "left",
  font = "jua",
  className,
}: {
  value: ReactNode;
  caption?: ReactNode;
  tone?: Tone;
  /** display(56px) | hero(32px) | h2(22px) */
  size?: "display" | "hero" | "h2";
  align?: "left" | "center";
  /** jua = 비집고 시그니처(둥근·정감), sans = 본문 페어링 */
  font?: "jua" | "sans";
  className?: string;
}) {
  const sizeClass =
    size === "display"
      ? "text-[3.5rem] leading-none"
      : size === "hero"
        ? "text-[2rem] leading-[1.1]"
        : "text-[1.375rem] leading-[1.3]";
  const fontClass = font === "jua" ? "font-jua" : "font-sans font-extrabold";
  const alignClass = align === "center" ? "text-center" : "text-left";
  return (
    <div className={`${alignClass} ${className ?? ""}`}>
      <p
        className={`tracking-tight tabular-nums ${fontClass} ${sizeClass}`}
        style={{ color: TONE_COLOR[tone] }}
      >
        {value}
      </p>
      {caption ? (
        <p className="mt-1.5 text-[0.875rem] leading-snug" style={{ color: "#8a857a" }}>
          {caption}
        </p>
      ) : null}
    </div>
  );
}
