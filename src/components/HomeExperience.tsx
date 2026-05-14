"use client";

import { useState } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import type { RecommendationResult } from "@/types/recommendation";
import { BudgetSummary } from "./BudgetSummary";
import { CandidateCard } from "./CandidateCard";

export function HomeExperience() {
  const [result, setResult] = useState<RecommendationResult | null>(null);

  if (result === null) {
    return <ProfileForm onResult={setResult} />;
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 예산 분석 */}
      <BudgetSummary budget={result.budget} />

      {/* 단지 목록 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-zinc-900">
          조건에 맞는 단지
        </h2>

        {result.candidates.length === 0 ? (
          <div className="rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 px-6 py-10 text-center">
            <p className="text-zinc-500 text-sm leading-relaxed">
              입력하신 조건에 딱 맞는 단지를 찾지 못했습니다.
              <br />
              통근 허용 시간이나 예산 범위를 조금 넓혀서 다시 시도해 보세요.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-6">
            {result.candidates.map((candidate, i) => (
              <li key={candidate.complexId}>
                <CandidateCard candidate={candidate} rank={i + 1} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 면책 고지 */}
      <footer className="rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 px-5 py-4">
        <p className="text-xs text-zinc-400 leading-relaxed">
          {result.disclaimer}
        </p>
      </footer>

      {/* 다시 입력하기 */}
      <div className="flex justify-center pb-4">
        <button
          type="button"
          onClick={() => setResult(null)}
          className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
        >
          다시 입력하기
        </button>
      </div>
    </div>
  );
}
