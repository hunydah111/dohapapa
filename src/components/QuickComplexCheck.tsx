"use client";

import { useEffect, useRef, useState } from "react";
import { formatKrwHuman, formatEok } from "@/lib/format";

// 역방향 진입(#4) — "관심 단지 하나 → 내 예산으로 닿아?" 가벼운 단답. 깔때기 입구 확장:
// 풀 5단계 폼 전에 단지명만으로 시세를 즉답하고, "정밀 플랜"으로 유도한다.
// 컴플라이언스: 실거래 추정 · 미래가치 예측 아님. 예산 판정은 거친 추정(정밀은 /plan).

interface Hit {
  id: string;
  name: string;
  sigungu: string;
  dongName: string;
  buildYear: number | null;
  repArea: number;
  repPriceKrw: number;
  areas: {
    area: number;
    priceKrw: number;
    priceLowKrw: number;
    priceHighKrw: number;
    count: number;
    lowConf: boolean;
  }[];
}

export function QuickComplexCheck() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [areaIdx, setAreaIdx] = useState(0);
  const [budgetEok, setBudgetEok] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- 검색 동기화(마운트 후·하이드레이션 무관), ProfileForm 패턴 */
  useEffect(() => {
    if (selected) return; // 선택 후엔 검색 안 함
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/complex-lookup?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results: Hit[] };
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const reset = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    setAreaIdx(0);
    setBudgetEok("");
  };

  const area = selected?.areas[areaIdx];
  const priceKrw = area?.priceKrw ?? selected?.repPriceKrw ?? 0;
  const budgetKrw = (parseFloat(budgetEok) || 0) * 1e8;
  const planHref = selected
    ? `/plan?price=${priceKrw}&name=${encodeURIComponent(selected.name)}&sgg=${encodeURIComponent(selected.sigungu)}&dong=${encodeURIComponent(selected.dongName)}&area=${area?.area ?? selected.repArea}`
    : "/plan";

  return (
    <section className="mx-auto w-full max-w-md rounded-3xl border border-[#ecd9b3] bg-[#fffdf8] p-5 shadow-sm">
      <p className="text-[15px] font-bold" style={{ color: "#3a2c1d" }}>
        🔎 관심 단지, 내 예산으로 닿아?
      </p>
      <p className="mb-3 mt-0.5 text-[12.5px]" style={{ color: "#8a7a63" }}>
        단지명만 넣으면 실거래 추정가를 바로 — 폼 없이 30초.
      </p>

      {!selected ? (
        <div className="relative">
          <div className="relative flex items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: 헬리오시티, 래미안위브"
              className="w-full rounded-2xl border border-[#d9c5a4] bg-white px-4 py-3 text-[15px] text-[#3a2c1d] placeholder-[#b3a99c] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-coral-500"
            />
            {loading && (
              <span className="absolute right-4 text-xs" style={{ color: "#b3a99c" }}>
                검색 중…
              </span>
            )}
          </div>
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-2 text-[12.5px]" style={{ color: "#b08948" }}>
              그 이름의 단지를 못 찾았어요 — 정식 단지명으로 넣어보세요.
            </p>
          )}
          {results.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 mt-1 overflow-hidden rounded-2xl border border-[#e5e0d5] bg-white shadow-xl">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(r);
                      // 기본 = 대표(표본 최다) 평형 — 가장 작은 평형보다 대표성 높음.
                      const repIdx = r.areas.findIndex((a) => a.area === r.repArea);
                      setAreaIdx(repIdx >= 0 ? repIdx : 0);
                    }}
                    className="flex w-full items-baseline gap-2 px-4 py-3 text-left transition-colors hover:bg-coral-50"
                  >
                    <span className="text-[14px] font-semibold text-[#3a2c1d]">{r.name}</span>
                    <span className="text-[12px]" style={{ color: "#9c8a72" }}>
                      {r.sigungu} {r.dongName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* 선택 단지 헤더 */}
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-[16px] font-extrabold" style={{ color: "#3a2c1d" }}>
              {selected.name}
              {selected.buildYear ? (
                <span className="ml-1 text-[12px] font-semibold" style={{ color: "#9c8a72" }}>
                  ({selected.buildYear}년식)
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={reset}
              className="shrink-0 text-[12px] font-semibold text-coral-600 hover:text-coral-800"
            >
              다시
            </button>
          </div>
          <span className="-mt-2 text-[12.5px]" style={{ color: "#8a7a63" }}>
            {selected.sigungu} {selected.dongName}
          </span>

          {/* 평형 칩 */}
          {selected.areas.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.areas.map((a, i) => (
                <button
                  key={a.area}
                  type="button"
                  onClick={() => setAreaIdx(i)}
                  title={a.lowConf ? `실거래 ${a.count}건 · 참고용` : `실거래 ${a.count}건`}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors ${
                    i === areaIdx
                      ? "bg-coral-600 text-white"
                      : "bg-[#f3ece4] text-[#6e5b46] hover:bg-[#ecd9b3]"
                  }`}
                >
                  {a.area}㎡
                  {a.lowConf && (
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: i === areaIdx ? "rgba(255,255,255,0.7)" : "#d8a23a" }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* 시세 — thin 평형은 점가격(false precision) 대신 범위/추정어려움으로(A1'). */}
          {area && area.count <= 1 ? (
            // 거래 1건 — 시세를 한 숫자로 못 박음. 약한 참고값만.
            <div className="flex flex-col gap-0.5">
              <span className="text-[16px] font-bold" style={{ color: "#9c8a72" }}>
                약 {formatEok(priceKrw)}{" "}
                <span className="text-[12px] font-medium">· 시세 추정 어려움</span>
              </span>
              <span className="text-[12px]" style={{ color: "#9c8a72" }}>
                전용 {area.area}㎡ · 실거래 {area.count}건뿐
              </span>
            </div>
          ) : area && area.count <= 3 && area.priceHighKrw > area.priceLowKrw ? (
            // 거래 2~3건 — 점가격 대신 실거래 범위로 정직하게.
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-jua text-[22px] tabular-nums tracking-tight" style={{ color: "#b87914" }}>
                {formatEok(area.priceLowKrw)}~{formatEok(area.priceHighKrw)}
              </span>
              <span className="text-[12px]" style={{ color: "#9c8a72" }}>
                전용 {area.area}㎡ · 실거래 {area.count}건 (범위)
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-jua text-[26px] tabular-nums tracking-tight" style={{ color: "#b87914" }}>
                {formatKrwHuman(priceKrw)}
              </span>
              <span className="text-[12px]" style={{ color: "#9c8a72" }}>
                전용 {area?.area ?? selected.repArea}㎡ · 실거래 {area?.count ?? 0}건 추정
              </span>
            </div>
          )}
          {/* 신뢰도 캐비엇 — 거래 적은 평형의 단일거래 fluke를 굵은 숫자로 오인하지 않게(정직성). */}
          {area?.lowConf && (
            <p className="-mt-1.5 text-[11.5px] leading-snug" style={{ color: "#c2731a" }}>
              ⚠️ 이 평형은 최근 실거래가 적어요(참고용) — 표본 많은 평형이나 아래 정밀 플랜으로 확인을 권해요.
            </p>
          )}

          {/* 예산 단답 */}
          <div className="rounded-2xl bg-[#fdf6e7] px-3.5 py-3">
            <label className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "#7a5a2a" }}>
              내가 끌어올 수 있는 총액
              <span className="inline-flex items-center">
                <input
                  type="number"
                  value={budgetEok}
                  onChange={(e) => setBudgetEok(e.target.value)}
                  placeholder="8"
                  className="w-16 rounded-lg border border-[#e0c9a0] bg-white px-2 py-1 text-right text-[14px] tabular-nums focus:outline-none focus:ring-2 focus:ring-coral-500"
                />
                <span className="ml-1">억</span>
              </span>
            </label>
            {budgetKrw > 0 && (
              <p className="mt-2 text-[13.5px] font-bold leading-snug">
                {budgetKrw >= priceKrw ? (
                  <span style={{ color: "#2f8a4e" }}>
                    ✅ 닿아요 — 약 {((budgetKrw - priceKrw) / 1e8).toFixed(1)}억 여유 (거친 추정)
                  </span>
                ) : (
                  <span style={{ color: "#c2731a" }}>
                    약 {((priceKrw - budgetKrw) / 1e8).toFixed(1)}억 더 모으면 닿아요 (거친 추정)
                  </span>
                )}
              </p>
            )}
            <p className="mt-1 text-[11px]" style={{ color: "#a99a82" }}>
              현금+받을 수 있는 대출 합산 추정. 정확한 대출·취득세는 아래 정밀 플랜에서.
            </p>
          </div>

          {/* CTA — /plan 으로 단지 prefill */}
          <a
            href={planHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-coral-600 px-5 py-3 text-[15px] font-bold text-white shadow-md transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-coral-500"
          >
            이 단지로 정밀 플랜 짜기 →
          </a>
        </div>
      )}
    </section>
  );
}
