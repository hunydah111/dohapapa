"use client";

import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost";
  size?: "lg" | "md";
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "lg",
  disabled = false,
  fullWidth = false,
  className = "",
}: ButtonProps) {
  /* ── 베이스 ── */
  const base =
    "inline-flex items-center justify-center whitespace-nowrap font-semibold rounded-2xl " +
    "transition-all duration-200 select-none cursor-pointer " +
    "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-indigo-600 focus-visible:ring-offset-2 " +
    "disabled:opacity-40 disabled:pointer-events-none";

  /* ── 크기 ── */
  const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
    lg: "h-12 px-6 text-[15px]",
    md: "h-10 px-5 text-sm",
  };

  /* ── 변형 ── */
  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 " +
      "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_-4px_rgba(79,70,229,0.35)]",
    secondary:
      "bg-white text-[#1d1d1f] border border-black/[0.10] " +
      "hover:bg-[#f5f5f7] " +
      "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
    ghost:
      "bg-transparent text-[#1d1d1f] hover:bg-black/[0.04]",
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size ?? "lg"]} ${variants[variant ?? "primary"]} ${widthClass} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
