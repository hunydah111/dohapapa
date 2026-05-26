import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** 조밀한 패딩(결과 카드 등 정보 밀도 높은 곳). 기본은 넉넉한 p-6/7. */
  compact?: boolean;
}

export function Card({ children, className = "", compact = false }: CardProps) {
  const pad = compact ? "p-4 sm:p-5" : "p-6 sm:p-7";
  return (
    <div className={`card-elevate bg-white rounded-3xl ${pad} ${className}`.trim()}>
      {children}
    </div>
  );
}
