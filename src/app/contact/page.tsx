import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, SERVICE_START_DATE, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `연락처 — ${SITE_NAME}`,
  description: `${SITE_NAME} 운영자 연락처 및 문의 안내`,
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <LegalPage title="연락처" effectiveDate={SERVICE_START_DATE}>
      <section>
        <h2 className="mb-2 text-lg font-semibold">문의 채널</h2>
        <p>
          서비스 이용 문의, 데이터 오류 제보, 광고/제휴 문의 등은 아래 이메일로
          연락주시기 바랍니다.
        </p>
        <p className="mt-3">
          이메일:{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-indigo-600 underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">자주 받는 문의</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>특정 단지 데이터가 안 나와요</strong> — 국토교통부 공개
            실거래가 API에 최근 6개월 거래가 등록되지 않은 단지는 결과에
            포함되지 않을 수 있습니다.
          </li>
          <li>
            <strong>예산 계산이 실제와 달라요</strong> — 공개된 DSR/LTV 산식
            기반의 추정치이며, 실제 대출 한도는 금융기관 심사에 따라 달라질 수
            있습니다.
          </li>
          <li>
            <strong>통근 시간이 부정확해요</strong> — 카카오 내비 자동차 경로
            기준 추정이며, 시간대·교통 상황에 따라 달라질 수 있습니다.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">운영자 정보</h2>
        <p>
          본 서비스는 개인 운영자가 비영리·정보 제공 목적으로 운영하며, 광고
          수익은 서버·API 운영비에 사용됩니다.
        </p>
      </section>
    </LegalPage>
  );
}
