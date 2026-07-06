import React from "react";

interface StepDotsProps {
  current: number; /* 0-based 현재 스텝 */
  total: number;
}

export function StepDots({ current, total }: StepDotsProps) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="status"
      aria-label={`${total}단계 중 ${current + 1}단계`}
    >
      {Array.from({ length: total }, (_, i) => {
        const active = i <= current;
        const isCurrent = i === current;

        return (
          <span
            key={i}
            className={
              "block rounded-full transition-all duration-300 " +
              (isCurrent
                ? "w-5 h-2 bg-coral-600"
                : active
                ? "w-2 h-2 bg-coral-400"
                : "w-2 h-2 bg-[#d9d4c7]")
            }
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}
