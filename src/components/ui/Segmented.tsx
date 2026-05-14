"use client";

import React from "react";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  columns?: number;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  columns,
}: SegmentedProps<T>) {
  const cols = columns ?? options.length;

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      role="group"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            className={
              "flex h-11 items-center justify-center rounded-2xl " +
              "text-sm font-semibold select-none cursor-pointer " +
              "transition-all duration-200 active:scale-[0.97] " +
              "focus-visible:outline-none focus-visible:ring-2 " +
              "focus-visible:ring-indigo-600 focus-visible:ring-offset-2 " +
              (selected
                ? "bg-indigo-600 text-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_-4px_rgba(79,70,229,0.35)]"
                : "bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#eaeaec]")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
