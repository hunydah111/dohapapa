import type { ReactNode } from "react";

type Props = {
  title: string;
  effectiveDate: string;
  children: ReactNode;
};

export function LegalPage({ title, effectiveDate, children }: Props) {
  return (
    <article className="mx-auto max-w-2xl px-4 pt-10 pb-20">
      <header className="mb-8">
        <h1
          className="text-2xl font-bold tracking-tight sm:text-3xl"
          style={{ color: "#1d1d1f" }}
        >
          {title}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#86868b" }}>
          시행일: {effectiveDate}
        </p>
      </header>
      <div
        className="space-y-6 text-[15px] leading-relaxed"
        style={{ color: "#1d1d1f" }}
      >
        {children}
      </div>
    </article>
  );
}
