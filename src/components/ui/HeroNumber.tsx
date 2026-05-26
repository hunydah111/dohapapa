// 토스 패턴 — 핵심 수치(D-day·가격·잔액)를 영웅화.
// 한 페이지에 1-2회만 사용 권장. 작은 수치는 본문 그대로.
//
// 사용 예:
//   <HeroNumber value="5억 2,400만" caption="추정 현재가" />
//   <HeroNumber value="D−3년 2개월" caption="지금 페이스 · 보합 가정" tone="accent" />

import type { ReactNode } from "react";

type Tone = "ink" | "accent" | "subtle";

const TONE_COLOR: Record<Tone, string> = {
  ink: "#3a2c1d",      // 진한 우드 브라운 (기본)
  accent: "#fe7644",   // 코랄 (강조)
  subtle: "#6e5b46",   // 부드러운 우디 (보조)
};

export function HeroNumber({
  value,
  caption,
  tone = "ink",
  size = "display",
  align = "left",
  className,
}: {
  value: ReactNode;
  caption?: ReactNode;
  tone?: Tone;
  /** display(56px) | hero(32px) */
  size?: "display" | "hero";
  align?: "left" | "center";
  className?: string;
}) {
  const valueClass =
    size === "display"
      ? "text-[3.5rem] leading-none"
      : "text-[2rem] leading-[1.1]";
  const alignClass = align === "center" ? "text-center" : "text-left";
  return (
    <div className={`${alignClass} ${className ?? ""}`}>
      <p
        className={`font-bold tracking-tight tabular-nums ${valueClass}`}
        style={{ color: TONE_COLOR[tone] }}
      >
        {value}
      </p>
      {caption ? (
        <p className="mt-1.5 text-[0.875rem] leading-snug" style={{ color: "#9a8f82" }}>
          {caption}
        </p>
      ) : null}
    </div>
  );
}
