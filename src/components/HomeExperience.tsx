"use client";

import { useState } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import type { RecommendationResult } from "@/types/recommendation";
import { BudgetSummary } from "./BudgetSummary";
import { CandidateCard } from "./CandidateCard";

function formatEok(krw: number): string {
  return `${(krw / 1_0000_0000).toFixed(1)}억`;
}

export function HomeExperience() {
  const [result, setResult] = useState<RecommendationResult | null>(null);

  if (result === null) {
    return <ProfileForm onResult={setResult} />;
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 예산 분석 */}
      <BudgetSummary budget={result.budget} />

      {/* 상세 리포트 단지 (최대 3개) */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">조건에 맞는 단지</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            검토한 {result.consideredComplexCount.toLocaleString()}개 단지 중
            상위 {result.candidates.length}곳입니다.
          </p>
        </div>

        {result.candidates.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center">
            <p className="text-sm leading-relaxed text-gray-500">
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

      {/* 그 밖의 후보 — 이름만 */}
      {result.moreCandidates.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-700">
            그 밖의 후보 {result.moreCandidates.length}곳
          </h2>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {result.moreCandidates.map((m, i) => (
              <li
                key={m.complexId}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="w-6 text-sm tabular-nums text-gray-400">
                  {i + 4}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900">
                    {m.complexName}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {m.sigungu} · {m.dongName} · {m.representativeArea}㎡
                  </span>
                </span>
                <span className="text-sm tabular-nums text-gray-600">
                  {formatEok(m.medianPriceKrw)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 면책 고지 */}
      <footer className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
        <p className="text-xs leading-relaxed text-gray-400">
          {result.disclaimer}
        </p>
      </footer>

      {/* 다시 입력하기 */}
      <div className="flex justify-center pb-2">
        <button
          type="button"
          onClick={() => setResult(null)}
          className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
        >
          다시 입력하기
        </button>
      </div>
    </div>
  );
}
