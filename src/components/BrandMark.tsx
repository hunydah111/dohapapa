// 홈앤나사이 — 콤파스 브랜드 마크.
//
// 메타포: 부부가 "집과 자신들 사이의 거리"를 좁히는 방향성 도구.
// 디자인: amber 바늘이 북(=집·따뜻함)을 가리키고 indigo 본체는 현재 위치.
// currentColor 로 본체 색을 상속 받아 헤더(indigo) / 다크 배경 어디든 맞춤.

type Props = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 24, className }: Props) {
  const stroke = Math.max(1.2, size / 18);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="홈앤나사이 로고"
      className={className}
    >
      {/* 외곽 원 */}
      <circle
        cx="16"
        cy="16"
        r="14"
        stroke="currentColor"
        strokeWidth={stroke}
      />
      {/* 4 방위 마커 (희미) */}
      <circle cx="16" cy="3.4" r="0.9" fill="currentColor" opacity="0.4" />
      <circle cx="16" cy="28.6" r="0.9" fill="currentColor" opacity="0.4" />
      <circle cx="3.4" cy="16" r="0.9" fill="currentColor" opacity="0.4" />
      <circle cx="28.6" cy="16" r="0.9" fill="currentColor" opacity="0.4" />
      {/* 위 바늘 — amber (북·집·따뜻함) */}
      <path d="M16 7 L19.2 16 L16 16 Z" fill="#f59e0b" />
      <path d="M16 7 L12.8 16 L16 16 Z" fill="#fbbf24" />
      {/* 아래 바늘 — indigo currentColor */}
      <path
        d="M16 25 L19.2 16 L16 16 Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path
        d="M16 25 L12.8 16 L16 16 Z"
        fill="currentColor"
        opacity="0.78"
      />
      {/* 중심 핀 */}
      <circle
        cx="16"
        cy="16"
        r="1.6"
        fill="white"
        stroke="currentColor"
        strokeWidth={stroke}
      />
    </svg>
  );
}
