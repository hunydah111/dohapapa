import { HomeExperience } from "@/components/HomeExperience";

export default function HomePage() {
  return (
    <main className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950">
      {/* 히어로 */}
      <section className="w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            우리 부부, 어디 살 수 있을까
          </h1>
          <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400">
            두 직장의 통근 거리·예산·학군 조건을 입력하면
            국토부 실거래가 기반으로 맞는 단지를 좁혀드립니다.
          </p>
        </div>
      </section>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <HomeExperience />
      </div>

      {/* 면책 안내 */}
      <div className="mx-auto w-full max-w-2xl px-4 pb-10">
        <p className="text-center text-xs text-zinc-400 leading-relaxed">
          이 서비스는 정보 제공 도구이며 부동산 중개 또는 투자 자문이 아닙니다.
        </p>
      </div>
    </main>
  );
}
