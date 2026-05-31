"use client";

import { useState } from "react";

/**
 * 비지 자산 이미지 + emoji 폴백 — 자산(public/biji/...)이 없거나 404여도 깨지지 않고 emoji로 degrade.
 *
 * ⚠️ SSR 레이스 방어: img가 초기 HTML에 실리면 React 하이드레이션 전에 브라우저가 먼저 로드를
 *    시도하고, 404가 onError 핸들러 부착보다 빠르면 에러 이벤트를 놓쳐 폴백이 영영 안 뜬다.
 *    ref 콜백에서 `complete && naturalWidth===0`(이미 실패한 상태)을 직접 확인해 그 레이스를 막는다.
 *    onError는 마운트 이후 발생하는 실패(캐시 미스 등)를 위해 함께 둔다.
 */
export function BijiFallbackImage({
  src,
  emoji,
  alt,
  className,
  emojiClassName,
}: {
  src: string;
  emoji: string;
  alt: string;
  /** img 크기 클래스. */
  className: string;
  /** emoji 폴백 span 클래스(글자 크기 등). 없으면 className 사용. */
  emojiClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className={emojiClassName ?? className} aria-hidden>
        {emoji}
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(img) => {
        if (img && img.complete && img.naturalWidth === 0) setFailed(true);
      }}
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
