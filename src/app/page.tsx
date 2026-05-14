import { HomeExperience } from "@/components/HomeExperience";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4">
      {/* 히어로 */}
      <section className="pt-12 pb-8 text-center sm:pt-16">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          우리 부부, 어디 살 수 있을까
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-gray-500">
          두 직장의 통근 거리·예산·학군 조건을 입력하면 국토부 실거래가로 살 만한
          단지를 좁혀드립니다.
        </p>
      </section>

      {/* 폼 / 결과 */}
      <HomeExperience />

      {/* 면책 안내 */}
      <p className="py-10 text-center text-xs leading-relaxed text-gray-400">
        본 서비스는 국토교통부 공개 실거래가를 바탕으로 한 정보 제공 도구이며,
        부동산 중개 또는 투자 자문이 아닙니다.
      </p>
    </div>
  );
}
