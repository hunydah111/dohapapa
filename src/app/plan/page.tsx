import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlanExperience } from "@/components/plan/PlanExperience";

export const metadata: Metadata = {
  title: "내 집 마련 플랜 — 언제 살 수 있을까?",
  description:
    "내 돈+나라돈으로 그 집을 언제쯤 살 수 있는지, 저축·부업·정책대출 레버로 시점을 당겨보는 계산기. 국토부 실거래가 기반 추정.",
  alternates: { canonical: "/plan" },
  openGraph: {
    title: "내 집 마련 플랜 — 언제 살 수 있을까?",
    description: "저축 vs 집값 경주로 보는 내 집 마련 시점. 레버로 당겨보세요.",
    type: "website",
    locale: "ko_KR",
    siteName: "비집고",
  },
};

export default function PlanPage() {
  return (
    <div className="relative mx-auto max-w-2xl px-4 pb-12 pt-4">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold" style={{ color: "#3a322c" }}>
          내 집 마련 플랜
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#6b6157" }}>
          내 돈으로 그 집, <b>언제쯤</b> 살 수 있을까
          <br />— 저축·부업·대출로 앞당겨보기
        </p>
      </div>

      {/* useSearchParams(찾기→플랜 prefill)를 위한 Suspense 경계 */}
      <Suspense fallback={null}>
        <PlanExperience />
      </Suspense>

      <div className="mt-8 text-center">
        <Link href="/" className="text-[13px] font-semibold underline" style={{ color: "#9a8f82" }}>
          ← 아파트 찾기로 돌아가기
        </Link>
      </div>
    </div>
  );
}
