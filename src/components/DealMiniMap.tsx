"use client";

import { useEffect, useRef, useState } from "react";
import { MiniMap, KAKAO_JS_ENABLED } from "./MiniMap";

// 지면(DailyFront) 행 펼침용 단지 1곳 미니맵 — MiniMap(카카오 SDK) 재사용 얇은 래퍼.
// DailyFront 는 서버 컴포넌트라 클라이언트 경계를 여기서 끊는다.
//
// lazy 마운트: <details> 안에 있어도 content 는 항상 DOM에 있으므로, 부모 details 의
// toggle 이벤트를 구독해 "처음 펼쳐진 뒤"에만 MiniMap 을 마운트한다 — 접힌 행 수십 개가
// 카카오 SDK·지도 인스턴스를 미리 만들지 않게(지면은 행이 많다).
// 키(NEXT_PUBLIC_KAKAO_JS_KEY) 없으면 null — 우아한 degrade(카카오맵 링크만 남음).

export function DealMiniMap({
  label,
  lat,
  lng,
}: {
  label: string;
  lat: number;
  lng: number;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!KAKAO_JS_ENABLED) return;
    const details = holderRef.current?.closest("details");
    if (!details) {
      // details 밖에서 쓰이면 즉시 마운트 (방어적 폴백)
      setOpened(true);
      return;
    }
    const sync = () => {
      if (details.open) setOpened(true); // 한 번 열리면 유지 — 재펼침 시 재로드 방지
    };
    sync();
    details.addEventListener("toggle", sync);
    return () => details.removeEventListener("toggle", sync);
  }, []);

  if (!KAKAO_JS_ENABLED) return null;

  return (
    <div ref={holderRef}>
      {opened && (
        <MiniMap
          pins={[{ lat, lng, label }]}
          className="h-40 w-full overflow-hidden border border-[#c9c3b4]"
        />
      )}
    </div>
  );
}
