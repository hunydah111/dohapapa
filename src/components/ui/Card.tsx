import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`bg-white rounded-3xl p-6 sm:p-7 ${className}`.trim()}
      style={{
        boxShadow:
          "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(0,0,0,0.12)",
      }}
    >
      {children}
    </div>
  );
}
