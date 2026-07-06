"use client";

import { useEffect, useRef } from "react";

// 결과 단지 위치 미니맵 — 카카오맵 JS SDK. browse 지도가 아니라 "결과 N곳이 여기"를
// 한눈에 보여주는 용도. NEXT_PUBLIC_KAKAO_JS_KEY 가 없으면 렌더하지 않는다(우아한 degrade).

const JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
export const KAKAO_JS_ENABLED = !!JS_KEY;

const SDK_ID = "kakao-maps-sdk";

// SDK 가 쓰는 최소 타입만 선언 (any 회피)
type LatLng = object;
interface KakaoMap {
  setBounds(b: KakaoBounds): void;
}
interface KakaoBounds {
  extend(ll: LatLng): void;
}
interface KakaoMaps {
  load(cb: () => void): void;
  Map: new (el: HTMLElement, opts: { center: LatLng; level: number }) => KakaoMap;
  LatLng: new (lat: number, lng: number) => LatLng;
  LatLngBounds: new () => KakaoBounds;
  Marker: new (opts: { position: LatLng; map?: KakaoMap }) => unknown;
  CustomOverlay: new (opts: {
    position: LatLng;
    content: string | HTMLElement;
    yAnchor?: number;
    xAnchor?: number;
    zIndex?: number;
  }) => { setMap(m: KakaoMap): void };
}
function getKakao(): { maps: KakaoMaps } | null {
  const w = window as unknown as { kakao?: { maps?: KakaoMaps } };
  return w.kakao && w.kakao.maps ? (w.kakao as { maps: KakaoMaps }) : null;
}

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (getKakao()) return resolve();
    const existing = document.getElementById(SDK_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("sdk load error")));
      return;
    }
    const s = document.createElement("script");
    s.id = SDK_ID;
    s.async = true;
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&autoload=false`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("sdk load error"));
    document.head.appendChild(s);
  });
}

export interface MapPin {
  lat: number;
  lng: number;
  label: string;
  rank?: number;
}

export function MiniMap({
  pins,
  workplaces = [],
  className = "h-60 w-full overflow-hidden rounded-3xl border border-black/[0.06]",
}: {
  pins: MapPin[];
  workplaces?: MapPin[];
  /** 컨테이너 스타일 오버라이드 — 지면(DailyFront) 행 지도는 신문 톤(각·괘선·160px)을 쓴다. */
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!JS_KEY || !ref.current || pins.length === 0) return;
    let cancelled = false;
    loadSdk()
      .then(() => {
        const k = getKakao();
        if (!k) return;
        k.maps.load(() => {
          if (cancelled || !ref.current) return;
          const { maps } = k;
          const map = new maps.Map(ref.current, {
            center: new maps.LatLng(pins[0].lat, pins[0].lng),
            level: 6,
          });
          const bounds = new maps.LatLngBounds();

          for (const p of pins) {
            const pos = new maps.LatLng(p.lat, p.lng);
            new maps.Marker({ position: pos, map });
            const badge = new maps.CustomOverlay({
              position: pos,
              yAnchor: 2.1,
              zIndex: 3,
              content: `<div style="padding:2px 7px;border-radius:9999px;background:#e8571f;color:#fff;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.25)">${p.rank ? p.rank + ". " : ""}${p.label}</div>`,
            });
            badge.setMap(map);
            bounds.extend(pos);
          }

          for (const wp of workplaces) {
            const pos = new maps.LatLng(wp.lat, wp.lng);
            const tag = new maps.CustomOverlay({
              position: pos,
              zIndex: 2,
              content: `<div style="display:flex;flex-direction:column;align-items:center"><div style="width:12px;height:12px;border-radius:9999px;background:#191713;border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.3)"></div><div style="margin-top:2px;padding:1px 6px;border-radius:9999px;background:#191713;color:#fff;font-size:10px;font-weight:700;white-space:nowrap">🏢 ${wp.label}</div></div>`,
            });
            tag.setMap(map);
            bounds.extend(pos);
          }

          map.setBounds(bounds);
        });
      })
      .catch(() => {
        /* SDK 로드 실패 — 미니맵 생략 */
      });

    return () => {
      cancelled = true;
    };
  }, [pins, workplaces]);

  if (!JS_KEY) return null;

  return (
    <div
      ref={ref}
      className={className}
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
      aria-label="결과 단지 위치 지도"
    />
  );
}
