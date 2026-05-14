"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pyeongToM2 } from "@/lib/area";

const SEOUL_GU = [
  "강남구", "강동구", "강북구", "강서구", "관악구",
  "광진구", "구로구", "금천구", "노원구", "도봉구",
  "동대문구", "동작구", "마포구", "서대문구", "서초구",
  "성동구", "성북구", "송파구", "양천구", "영등포구",
  "용산구", "은평구", "종로구", "중구", "중랑구",
];

interface FormState {
  complexName: string;
  sigungu: string;
  dongName: string;
  pyeong: string;
  askPriceEok: string;
  floor: string;
  direction: string;
  description: string;
  externalUrl: string;
}

const initialState: FormState = {
  complexName: "",
  sigungu: "",
  dongName: "",
  pyeong: "",
  askPriceEok: "",
  floor: "",
  direction: "",
  description: "",
  externalUrl: "",
};

export function ListingForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const pyeong = parseFloat(form.pyeong);
    const askEok = parseFloat(form.askPriceEok);

    if (!form.complexName.trim()) {
      setError("단지명을 입력해 주세요.");
      return;
    }
    if (isNaN(pyeong) || pyeong <= 0) {
      setError("평수를 올바르게 입력해 주세요.");
      return;
    }
    if (isNaN(askEok) || askEok <= 0) {
      setError("호가를 올바르게 입력해 주세요.");
      return;
    }

    const area = pyeongToM2(pyeong);
    // 호가는 억 단위로 받아 원 단위 bigint 로 변환. 1억 = 100_000_000원.
    const priceKrw = BigInt(Math.round(askEok * 1_000_000)) * 100n;

    const body: Record<string, unknown> = {
      complexName: form.complexName.trim(),
      area,
      askPriceKrw: priceKrw.toString(),
    };
    if (form.sigungu) body.sigungu = form.sigungu;
    if (form.dongName.trim()) body.dongName = form.dongName.trim();
    if (form.floor) body.floor = parseInt(form.floor, 10);
    if (form.direction.trim()) body.direction = form.direction.trim();
    if (form.description.trim()) body.description = form.description.trim();
    if (form.externalUrl.trim()) body.externalUrl = form.externalUrl.trim();

    setSubmitting(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const msg =
          data !== null &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as Record<string, unknown>).error === "string"
            ? (data as Record<string, string>).error
            : `서버 오류 (${res.status})`;
        throw new Error(msg);
      }

      const { id } = (await res.json()) as { id: string };
      router.push(`/analyze/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>단지명 *</label>
            <input
              type="text"
              className={inputCls}
              placeholder="예: 잠실엘스"
              value={form.complexName}
              onChange={(e) => set("complexName", e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>평수 *</label>
              <input
                type="number"
                min="0"
                step="1"
                className={inputCls}
                placeholder="예: 25"
                value={form.pyeong}
                onChange={(e) => set("pyeong", e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">전용 기준 (84㎡ ≈ 25평)</p>
            </div>
            <div>
              <label className={labelCls}>호가 (억) *</label>
              <input
                type="number"
                min="0"
                step="0.1"
                className={inputCls}
                placeholder="예: 18.5"
                value={form.askPriceEok}
                onChange={(e) => set("askPriceEok", e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">소수점 가능 (18.5 = 18억 5천)</p>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              {showOptional ? "− 선택 입력 접기" : "+ 선택 입력 열기 (시군구·층·향·설명 등)"}
            </button>
          </div>

          {showOptional && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>시군구</label>
                  <select
                    className={inputCls}
                    value={form.sigungu}
                    onChange={(e) => set("sigungu", e.target.value)}
                  >
                    <option value="">선택 안 함</option>
                    {SEOUL_GU.map((gu) => (
                      <option key={gu} value={gu}>
                        {gu}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>법정동</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="예: 잠실동"
                    value={form.dongName}
                    onChange={(e) => set("dongName", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>층</label>
                  <input
                    type="number"
                    min="1"
                    className={inputCls}
                    placeholder="예: 12"
                    value={form.floor}
                    onChange={(e) => set("floor", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>향</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="예: 남향"
                    value={form.direction}
                    onChange={(e) => set("direction", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>네이버 매물 URL (선택)</label>
                <input
                  type="url"
                  className={inputCls}
                  placeholder="https://new.land.naver.com/articles/..."
                  value={form.externalUrl}
                  onChange={(e) => set("externalUrl", e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-400">참고용 — 분석은 위 입력값 기준</p>
              </div>
              <div>
                <label className={labelCls}>매물 설명</label>
                <textarea
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="중개사가 적은 설명을 그대로 붙여넣으면 키워드 분석에 사용됩니다."
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
          >
            {submitting ? "분석 중…" : "의심 점수 분석하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
