"use client";

import { useEffect, useState } from "react";

// 다음 자동 갱신까지 D-day — 매주 일요일 06시(KST) 크론. 라이브로 줄어드는 카운트다운(살아있음).
export function NextRefresh() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      let add = (7 - now.getDay()) % 7; // 0 = 일요일
      if (add === 0 && now.getHours() >= 6) add = 7; // 일요일 06시 지났으면 다음 주
      const next = new Date(now);
      next.setDate(now.getDate() + add);
      next.setHours(6, 0, 0, 0);
      const ms = next.getTime() - now.getTime();
      const days = Math.floor(ms / 86_400_000);
      const hrs = Math.floor((ms % 86_400_000) / 3_600_000);
      setLabel(days > 0 ? `D-${days}` : hrs > 0 ? `${hrs}시간 후` : "곧");
    };
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, []);

  return <span>{label || "—"}</span>;
}
