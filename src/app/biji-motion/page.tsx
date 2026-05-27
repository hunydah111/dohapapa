// 임시 — 달리는 비지 모션 모바일 확인용 데모 페이지.
// 합격 후 삭제 약속. 라우트 /biji-motion.

export const metadata = {
  title: "달리는 비지 — 모션 시범",
  robots: { index: false, follow: false }, // 검색 노출 X
};

export default function BijiMotionDemoPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12 text-white"
      style={{
        background:
          "linear-gradient(135deg,#ff8a5c 0%,#fe7644 55%,#e8662f 100%)",
      }}
    >
      <p className="text-[12px] font-semibold uppercase tracking-wider text-white/80">
        Round 3 시범
      </p>
      <h1 className="font-jua text-3xl leading-tight">달리는 비지 · 모션</h1>

      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        width={280}
        height={280}
        className="drop-shadow-2xl"
        style={{ borderRadius: 32, background: "rgba(255,255,255,0.08)" }}
        aria-label="달리는 비지 비디오"
      >
        <source src="/biji/biji-running.mp4" type="video/mp4" />
      </video>

      <div className="max-w-[280px] space-y-2 text-center text-[13px] leading-relaxed text-white/90">
        <p>
          PixVerse 5.5 image-to-video · 652KB · 자동 재생 · 무음 · 무한 루프
        </p>
        <p className="text-white/70">
          비디오 안 보이면 reduce-motion 끄고 새로고침.
        </p>
        <p className="text-[11px] text-white/55">
          합격이면 나머지 11장 같은 방식으로 확장 — 이 페이지는 합격 후 삭제.
        </p>
      </div>
    </main>
  );
}
