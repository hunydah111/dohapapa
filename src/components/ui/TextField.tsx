"use client";

import React, { useId } from "react";

interface TextFieldProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  type?: "text" | "number" | "url";
  hint?: string;
  suffix?: string;
  autoFocus?: boolean;
}

export function TextField({
  value,
  onChange,
  label,
  placeholder,
  type = "text",
  hint,
  suffix,
  autoFocus = false,
}: TextFieldProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      {/* 라벨 */}
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-semibold"
          style={{ color: "#3a322c" }}
        >
          {label}
        </label>
      )}

      {/* 입력 래퍼 */}
      <div className="relative flex items-center">
        <input
          id={id}
          type={type}
          inputMode={type === "number" ? "numeric" : undefined}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            // number 칸: 맨 앞 0 제거("0150" → "150"). 단독 "0"·소수("0.5")는 보존.
            const next =
              type === "number"
                ? raw.replace(/^0+(?=\d)/, "")
                : raw;
            onChange(next);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={
            "w-full rounded-2xl bg-[#f3ece4] px-4 text-[15px] text-[#3a322c] " +
            "placeholder:text-[#9a8f82] " +
            "border border-transparent " +
            "transition-all duration-200 " +
            "focus:outline-none focus:bg-white focus:border-coral-600 " +
            "focus:shadow-[0_0_0_3px_rgba(242,96,60,0.12)] " +
            (suffix ? "pr-14 " : "") +
            "h-12"
          }
          style={{ WebkitAppearance: "none" }}
        />

        {/* 접미사 */}
        {suffix && (
          <span
            className="pointer-events-none absolute right-4 text-sm font-medium"
            style={{ color: "#9a8f82" }}
          >
            {suffix}
          </span>
        )}
      </div>

      {/* 도움말 */}
      {hint && (
        <p className="text-xs leading-relaxed" style={{ color: "#9a8f82" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
