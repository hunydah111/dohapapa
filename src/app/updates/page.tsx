import type { Metadata } from "next";
import Link from "next/link";
import { getUpdateEntries, getLatestUpdate, fmtDot } from "@/lib/updateLog";
import { NextRefresh } from "@/components/NextRefresh";

export const metadata: Metadata = {
  title: "데이터 업데이트 현황 — 매주 자동 갱신 | 비집고",
  description:
    "비집고는 매주 일요일 국토부 공개 실거래를 자동으로 다시 받아 반영합니다. 사람이 손대지 않아도 데이터가 계속 자라는 기록 — 누적 거래·수록 단지·갱신 이력.",
};

export default function UpdatesPage() {
  const latest = getLatestUpdate();
  const entries = getUpdateEntries();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 py-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-coral-600 hover:text-coral-800">← 비집고</Link>
        <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "#5f8a6a" }}>
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="live-dot absolute inline-flex h-full w-full rounded-full" style={{ background: "#4f9d54" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#4f9d54" }} />
          </span>
          자동 갱신 중
        </span>
      </div>

      {/* 헤더 */}
      <div className="rounded-3xl px-5 py-5 text-center" style={{ background: "linear-gradient(160deg,#fff4ef,#f7ead0)" }}>
        <p className="font-jua text-[22px]" style={{ color: "#e8662f" }}>데이터 업데이트 현황</p>
        <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "#6e5b46" }}>
          매주 일요일, 국토부 공개 실거래를
          <br />
          <b>자동으로 다시 받아 반영</b>합니다.
          <br />
          <span className="text-[12px]" style={{ color: "#9a8f82" }}>사람이 손대지 않아도 데이터는 계속 자랍니다.</span>
        </p>
      </div>

      {/* 현재 상태 카드 */}
      {latest && (
        <div className="rounded-3xl border border-[#ecd9b3] bg-[#fffdf8] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold" style={{ color: "#b08948" }}>지금 반영된 데이터</span>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "#eaf5ec", color: "#3f7a52" }}>
              다음 갱신 <NextRefresh />
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="최신 실거래" value={fmtDot(latest.latestDealDate)} />
            <Stat label="누적 실거래" value={`${latest.txCount.toLocaleString()}건`} />
            {latest.complexCount != null && <Stat label="수록 단지" value={`${latest.complexCount.toLocaleString()}곳`} />}
            {latest.topMomentum && (
              <Stat label="이 달 최고 상승" value={`${latest.topMomentum.sigungu} +${latest.topMomentum.pct}%`} />
            )}
          </div>
          <p className="mt-3 text-[11px]" style={{ color: "#9a8f82" }}>
            매주 일요일 새벽 자동 파이프라인 → 새 실거래만 반영 → 사이트 자동 배포.
          </p>
        </div>
      )}

      {/* 갱신 타임라인 */}
      <div>
        <p className="mb-2 px-1 text-[12px] font-bold" style={{ color: "#9a8f82" }}>갱신 이력</p>
        <ol className="flex flex-col">
          {entries.map((e, i) => (
            <li key={e.date} className="flex gap-3">
              {/* 타임라인 점/선 */}
              <div className="flex flex-col items-center">
                <span
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: i === 0 ? "#e8662f" : "#d9c5a4" }}
                />
                {i < entries.length - 1 && <span className="w-px flex-1" style={{ background: "#e6dcc9" }} />}
              </div>
              {/* 내용 */}
              <div className="flex-1 pb-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-bold" style={{ color: "#3a2c1d" }}>{fmtDot(e.date)}</span>
                  {i === 0 && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#fff1ea", color: "#e8662f" }}>
                      최신
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[13px]" style={{ color: "#6e5b46" }}>
                  누적 실거래 <b>{e.txCount.toLocaleString()}건</b>
                  {e.newTx != null && e.newTx > 0 && (
                    <span style={{ color: "#3f7a52" }}> · +{e.newTx.toLocaleString()}건 신규</span>
                  )}
                  {e.newTx == null && <span style={{ color: "#9a8f82" }}> · 첫 공개</span>}
                </p>
                <p className="text-[11.5px]" style={{ color: "#9a8f82" }}>
                  국토부 실거래 {fmtDot(e.latestDealDate)}까지 반영
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: "#b3a99c" }}>
        국토부 공개 실거래(매매) 기준 · 자동 파이프라인으로 주 1회 증분 갱신 · 추정 시세는 비감정평가 참고용.
        호가가 아니라 <b>실제 체결된 거래</b>만 반영합니다.
      </p>

      <Link
        href="/"
        className="mx-auto mt-1 flex w-full items-center justify-center rounded-2xl bg-coral-600 py-3 text-[15px] font-bold text-white"
      >
        내 통장에 맞는 단지 찾아보기 →
      </Link>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-3 py-2.5" style={{ background: "#faf4e8" }}>
      <p className="text-[11px]" style={{ color: "#9a8f82" }}>{label}</p>
      <p className="mt-0.5 text-[15px] font-extrabold leading-tight" style={{ color: "#3a2c1d" }}>{value}</p>
    </div>
  );
}
