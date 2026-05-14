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
          style={{ color: "#1d1d1f" }}
        >
          {label}
        </label>
      )}

      {/* 입력 래퍼 */}
      <div className="relative flex items-center">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={
            "w-full rounded-2xl bg-[#f5f5f7] px-4 text-[15px] text-[#1d1d1f] " +
            "placeholder:text-[#86868b] " +
            "border border-transparent " +
            "transition-all duration-200 " +
            "focus:outline-none focus:bg-white focus:border-indigo-600 " +
            "focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)] " +
            (suffix ? "pr-14 " : "") +
            "h-12"
          }
          style={{ WebkitAppearance: "none" }}
        />

        {/* 접미사 */}
        {suffix && (
          <span
            className="pointer-events-none absolute right-4 text-sm font-medium"
            style={{ color: "#86868b" }}
          >
            {suffix}
          </span>
        )}
      </div>

      {/* 도움말 */}
      {hint && (
        <p className="text-xs leading-relaxed" style={{ color: "#86868b" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
