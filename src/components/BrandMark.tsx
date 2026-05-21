// 비집고 — 브랜드 마크 (집 실루엣).
//
// 컨셉: 브랜드 이름 "Home & 나 사이" 의 시각화.
//   - 왼쪽 indigo 반쪽 = 나 (currentColor 상속으로 헤더 톤과 동기화)
//   - 오른쪽 amber 반쪽 = Home (따뜻함·도착지)
//   - 중앙 흰 원 = "사이" (Home 과 나 사이의 공간, 이 도구가 메우려는 거리)
// 집 실루엣을 유지하되 단순 그림이 아닌 브랜드의 메타포 그 자체.

type Props = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 24, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="비집고 로고"
      className={className}
    >
      {/* 나 (왼쪽 반쪽, indigo) — 바닥 모서리 라운드 */}
      <path
        d="M16 4 L4 13 L4 26 Q4 28 6 28 L16 28 Z"
        fill="currentColor"
      />
      {/* Home (오른쪽 반쪽, amber) — 바닥 모서리 라운드 */}
      <path
        d="M16 4 L28 13 L28 26 Q28 28 26 28 L16 28 Z"
        fill="#f59e0b"
      />
      {/* "사이" — Home 과 나 사이의 공간, 벽 중앙 */}
      <circle cx="16" cy="16" r="3.5" fill="white" />
    </svg>
  );
}
