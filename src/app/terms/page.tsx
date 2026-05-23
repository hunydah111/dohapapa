import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, SERVICE_START_DATE, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `이용약관 — ${SITE_NAME}`,
  description: `${SITE_NAME} 서비스 이용약관`,
  robots: { index: true, follow: true },
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="이용약관" effectiveDate={SERVICE_START_DATE}>
      <section>
        <h2 className="mb-2 text-lg font-semibold">제1조 (목적)</h2>
        <p>
          본 약관은 {SITE_NAME}(이하 &ldquo;서비스&rdquo;)이 제공하는 부부 조건 기반
          아파트 단지 정보 탐색 기능의 이용 조건을 규정함을 목적으로 합니다.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제2조 (서비스의 성격)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            본 서비스는 국토교통부 실거래가 공개 API의 데이터를 가공하여
            사용자가 입력한 조건과의 부합 정도를 정보로 제공하는{" "}
            <strong>정보 제공 도구</strong>입니다.
          </li>
          <li>
            본 서비스는 「공인중개사법」상 부동산 중개행위, 「자본시장과
            금융투자업에 관한 법률」상 투자 자문, 「대부업법」 및 관련 법령상
            대출모집업에 해당하지 않으며, 그와 같은 행위를 일절 하지 않습니다.
          </li>
          <li>
            본 서비스가 제공하는 결과는 매매 알선, 투자 권유, 금융상품 추천이
            아닌 <strong>의사결정 보조를 위한 참고 자료</strong>이며, 최종 매수
            의사결정 및 그에 따른 책임은 전적으로 이용자 본인에게 있습니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제3조 (서비스 이용)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>회원가입 없이 누구나 무료로 이용할 수 있습니다.</li>
          <li>
            서비스 운영을 위해 사전 고지 없이 일부 기능을 변경·중단할 수
            있습니다.
          </li>
          <li>
            서비스 안정성 확보를 위해 비정상적인 대량 요청·자동화된 접근은
            제한될 수 있습니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제4조 (데이터 정확성 및 면책)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            거래 데이터는 국토교통부 공개 API를 출처로 하며, 최신성·정확성은
            원본 데이터에 의존합니다. 운영자는 데이터 누락·오류에 대해 별도의
            보증을 하지 않습니다.
          </li>
          <li>
            예산·대출 한도·통근 시간 등 추정값은 공개된 산식 또는 외부 API를
            기반으로 한 <strong>참고용 추정</strong>입니다. 실제 대출 가능
            금액은 금융기관 심사 결과에 따르며, 실제 이동시간은 교통 상황에
            따라 달라집니다.
          </li>
          <li>
            본 서비스의 정보 이용으로 발생한 직·간접적 손해에 대하여 운영자는
            법령상 면책되는 한도에서 책임을 지지 않습니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제5조 (지적재산권)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            서비스 내 문구·디자인·로고·코드 등 일체의 콘텐츠에 대한 권리는
            운영자에게 있습니다.
          </li>
          <li>
            국토교통부·카카오·네이버·ODsay 등 외부 데이터의 권리는 각 출처에
            귀속됩니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제6조 (광고)</h2>
        <p>
          본 서비스는 운영비 충당을 위해 Google AdSense 등 제3자 광고 네트워크의
          광고를 노출할 수 있습니다. 광고 콘텐츠는 광고주의 책임 하에 제공되며,
          운영자는 광고 상품·서비스의 품질에 대해 책임을 지지 않습니다.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제7조 (금지 행위)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>서비스를 영리 목적으로 무단 복제·재배포하는 행위</li>
          <li>크롤러·자동화 도구로 대량 요청을 발생시키는 행위</li>
          <li>서비스의 정상 운영을 방해하는 일체의 행위</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제8조 (약관의 변경)</h2>
        <p>
          본 약관은 관련 법령 또는 서비스 정책 변경에 따라 개정될 수 있으며,
          개정 시 사이트 내 공지를 통해 시행 7일 전 안내합니다.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제9조 (준거법 및 관할)</h2>
        <p>
          본 약관은 대한민국 법령에 따라 해석·적용되며, 서비스 이용과 관련한
          분쟁은 민사소송법상 관할법원을 따릅니다.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">문의</h2>
        <p>
          이메일:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-coral-600 underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </LegalPage>
  );
}
