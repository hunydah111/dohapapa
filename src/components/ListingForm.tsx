"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SEOUL_GU = [
  "강남구", "강동구", "강북구", "강서구", "관악구",
  "광진구", "구로구", "금천구", "노원구", "도봉구",
  "동대문구", "동작구", "마포구", "서대문구", "서초구",
  "성동구", "성북구", "송파구", "양천구", "영등포구",
  "용산구", "은평구", "종로구", "중구", "중랑구",
];

type TabMode = "url" | "manual";

interface UrlFormState {
  externalUrl: string;
  askPriceMan: string;
  area: string;
}

interface ManualFormState {
  complexName: string;
  sigungu: string;
  dongName: string;
  area: string;
  askPriceMan: string;
  floor: string;
  direction: string;
  description: string;
}

export function ListingForm() {
  const router = useRouter();
  const [tab, setTab] = useState<TabMode>("url");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [urlForm, setUrlForm] = useState<UrlFormState>({
    externalUrl: "",
    askPriceMan: "",
    area: "",
  });

  const [manualForm, setManualForm] = useState<ManualFormState>({
    complexName: "",
    sigungu: "",
    dongName: "",
    area: "",
    askPriceMan: "",
    floor: "",
    direction: "",
    description: "",
  });

  function setUrl<K extends keyof UrlFormState>(key: K, value: string) {
    setUrlForm((prev) => ({ ...prev, [key]: value }));
  }

  function setManual<K extends keyof ManualFormState>(key: K, value: string) {
    setManualForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const askMan =
        tab === "url"
          ? parseFloat(urlForm.askPriceMan)
          : parseFloat(manualForm.askPriceMan);
      const area =
        tab === "url"
          ? parseFloat(urlForm.area)
          : parseFloat(manualForm.area);

      if (isNaN(askMan) || askMan <= 0) {
        throw new Error("호가를 올바르게 입력해 주세요.");
      }
      if (isNaN(area) || area <= 0) {
        throw new Error("전용면적을 올바르게 입력해 주세요.");
      }
      if (tab === "manual" && !manualForm.complexName.trim()) {
        throw new Error("단지명을 입력해 주세요.");
      }

      const askPriceKrwStr = String(BigInt(Math.round(askMan)) * 10000n);

      const body: Record<string, unknown> = {
        askPriceKrw: askPriceKrwStr,
        area,
      };

      if (tab === "url") {
        if (!urlForm.externalUrl.trim()) {
          throw new Error("Naver 매물 URL을 입력해 주세요.");
        }
        body.externalUrl = urlForm.externalUrl.trim();
        body.complexName = "";
      } else {
        body.complexName = manualForm.complexName.trim();
        if (manualForm.sigungu) body.sigungu = manualForm.sigungu;
        if (manualForm.dongName.trim()) body.dongName = manualForm.dongName.trim();
        if (manualForm.floor) body.floor = parseInt(manualForm.floor, 10);
        if (manualForm.direction.trim()) body.direction = manualForm.direction.trim();
        if (manualForm.description.trim()) body.description = manualForm.description.trim();
      }

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

  const tabBase =
    "flex-1 py-2 text-sm font-medium rounded-xl transition-colors focus:outline-none";
  const tabActive = "bg-white text-indigo-700 shadow-sm";
  const tabInactive = "text-gray-500 hover:text-gray-700";

  const inputCls =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-5">
        {/* Tab toggle */}
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setTab("url")}
            className={`${tabBase} ${tab === "url" ? tabActive : tabInactive}`}
          >
            URL 붙여넣기
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={`${tabBase} ${tab === "manual" ? tabActive : tabInactive}`}
          >
            직접 입력
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "url" ? (
            <>
              <div>
                <label className={labelCls}>네이버 매물 URL</label>
                <input
                  type="url"
                  className={inputCls}
                  placeholder="https://land.naver.com/..."
                  value={urlForm.externalUrl}
                  onChange={(e) => setUrl("externalUrl", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>호가 (만원)</label>
                  <input
                    type="number"
                    min="0"
                    className={inputCls}
                    placeholder="예: 90000"
                    value={urlForm.askPriceMan}
                    onChange={(e) => setUrl("askPriceMan", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>전용면적 (㎡)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    placeholder="예: 84.99"
                    value={urlForm.area}
                    onChange={(e) => setUrl("area", e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>단지명 *</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="예: 래미안 퍼스티지"
                  value={manualForm.complexName}
                  onChange={(e) => setManual("complexName", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>시군구</label>
                  <select
                    className={inputCls}
                    value={manualForm.sigungu}
                    onChange={(e) => setManual("sigungu", e.target.value)}
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
                    placeholder="예: 반포동"
                    value={manualForm.dongName}
                    onChange={(e) => setManual("dongName", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>전용면적 (㎡) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    placeholder="예: 84.99"
                    value={manualForm.area}
                    onChange={(e) => setManual("area", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>호가 (만원) *</label>
                  <input
                    type="number"
                    min="0"
                    className={inputCls}
                    placeholder="예: 90000"
                    value={manualForm.askPriceMan}
                    onChange={(e) => setManual("askPriceMan", e.target.value)}
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
                    value={manualForm.floor}
                    onChange={(e) => setManual("floor", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>향</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="예: 남향"
                    value={manualForm.direction}
                    onChange={(e) => setManual("direction", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>매물 설명</label>
                <textarea
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="매물 설명을 입력하세요."
                  value={manualForm.description}
                  onChange={(e) => setManual("description", e.target.value)}
                />
              </div>
            </>
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
