import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, SERVICE_START_DATE, SITE_NAME } from "@/lib/site";

// 약관 개정(2026-07-10 공지 → 2026-07-17 시행, 제8조의 7일 전 공지 절차 준수).
// 개정 요지: ①서비스 서술을 v2(일간 지면 발행·동네판·독자 스탬프)로 현행화
// ②광고 조항을 /principles "무광고" 공개 선언과 정합(모순 해소) ③정정 요청 절차 신설
// ④지면은 언론(인터넷신문)이 아닌 데이터 자동 발행 서비스임을 명시.
// 시행일 전 빌드는 현행 약관 + 개정 공지(전문 접힘)를, 시행일 후 첫 빌드부터는
// 개정 약관을 본문으로 렌더한다 — 매일 새벽 데이터 커밋이 재배포를 보장하므로 자동 전환.
const REVISION_NOTICE_DATE = "2026-07-10";
const REVISION_EFFECTIVE_DATE = "2026-07-17";
const revisionInEffect = Date.now() >= new Date(`${REVISION_EFFECTIVE_DATE}T00:00:00+09:00`).getTime();

export const metadata: Metadata = {
  title: `이용약관 — ${SITE_NAME}`,
  description: `${SITE_NAME} 서비스 이용약관`,
  robots: { index: true, follow: true },
  alternates: { canonical: "/terms" },
};

/** 개정 약관 전문 (2026-07-15 시행). */
function RevisedTerms() {
  return (
    <>
      <section>
        <h2 className="mb-2 text-lg font-semibold">제1조 (목적)</h2>
        <p>
          본 약관은 {SITE_NAME}(이하 &ldquo;서비스&rdquo;)이 제공하는 ① 국토교통부
          실거래가 공개 데이터를 매일 판독해 발행하는 일간 지면(1면·동네판·동네면),
          ② 이용자 조건 기반 아파트 단지 정보 탐색 기능의 이용 조건을 규정함을
          목적으로 합니다.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제2조 (서비스의 성격)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            본 서비스는 국토교통부 실거래가 공개 API의 데이터를 가공하여 제공하는{" "}
            <strong>정보 제공 도구</strong>입니다.
          </li>
          <li>
            일간 지면(헤드라인·집계·순위 포함)은 공개 데이터에 대해 사전에 공표된
            기계적 규칙(
            <a href="/principles" className="underline underline-offset-2">
              편집 원칙
            </a>
            )을 적용해 자동 생성한 판독물로서, 「신문 등의 진흥에 관한 법률」상
            신문·인터넷신문 등 언론매체가 아니며 취재·논평을 포함하지 않습니다.
          </li>
          <li>
            본 서비스는 「공인중개사법」상 부동산 중개행위, 「자본시장과
            금융투자업에 관한 법률」상 투자 자문, 「대부업법」 및 관련 법령상
            대출모집업에 해당하지 않으며, 그와 같은 행위를 일절 하지 않습니다.
          </li>
          <li>
            본 서비스가 제공하는 결과는 매매 알선, 투자 권유, 금융상품 추천이 아닌{" "}
            <strong>의사결정 보조를 위한 참고 자료</strong>이며, 최종 의사결정 및
            그에 따른 책임은 전적으로 이용자 본인에게 있습니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제3조 (서비스 이용)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>회원가입 없이 누구나 무료로 이용할 수 있습니다.</li>
          <li>
            동네판 구독, 판정 입력값 등 개인화 정보는 이용자의 브라우저(기기)에만
            저장되며 서버로 전송·보관하지 않습니다.
          </li>
          <li>서비스 운영을 위해 사전 고지 없이 일부 기능을 변경·중단할 수 있습니다.</li>
          <li>
            서비스 안정성 확보를 위해 비정상적인 대량 요청·자동화된 접근은 제한될
            수 있습니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제4조 (독자 참여 — 거래 스탬프)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            지면의 스탬프(과열·적당·싸다 등)는 이미 체결·공개된 지난 거래에 대한
            독자의 주관적 평가 집계로, 특정 자산의 매수·매도 권유 또는 시세 평가가
            아닙니다.
          </li>
          <li>
            매크로·조직적 반복 참여 등 집계를 왜곡하는 행위는 금지되며, 운영자는
            이상 참여가 감지된 집계를 보류·삭제할 수 있습니다.
          </li>
          <li>참여 내역은 익명 집계로만 처리하며 개인을 식별하지 않습니다.</li>
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제5조 (데이터 정확성 및 면책)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            거래 데이터는 국토교통부 공개 API를 출처로 하며, 최신성·정확성은 원본
            데이터에 의존합니다. 실거래 신고는 계약 후 최대 30일 지연될 수 있어
            지면은 &ldquo;공개일&rdquo; 기준으로 작성됩니다. 운영자는 원본 데이터의
            누락·오류에 대해 별도의 보증을 하지 않습니다.
          </li>
          <li>
            지면의 헤드라인·집계·순위는 기계적 규칙에 따른 자동 선별로, 사실과
            다른 내용이 확인되면 제9조의 절차로 신속히 정정합니다.
          </li>
          <li>
            예산·대출 한도·통근 시간 등 추정값은 공개된 산식 또는 외부 API를 기반으로
            한 <strong>참고용 추정</strong>입니다. 실제 대출 가능 금액은 금융기관 심사
            결과에 따르며, 실제 이동시간은 교통 상황에 따라 달라집니다.
          </li>
          <li>
            화면에 표시되는 <strong>추정 시세</strong>는 공개 실거래가를 가공한
            통계적 추정치로서 「감정평가 및 감정평가사에 관한 법률」상 감정평가액이
            아니며, 감정평가·담보 설정 등 금융거래의 기초자료로 사용할 수 없습니다.
          </li>
          <li>
            본 서비스의 정보 이용으로 발생한 직·간접적 손해에 대하여 운영자는 법령상
            면책되는 한도에서 책임을 지지 않습니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제6조 (지적재산권)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            서비스 내 문구·디자인·로고·코드 등 일체의 콘텐츠에 대한 권리는
            운영자에게 있습니다.
          </li>
          <li>
            국토교통부·한국부동산원·카카오·네이버·ODsay 등 외부 데이터의 권리는
            각 출처에 귀속됩니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제7조 (광고)</h2>
        <p>
          본 서비스는 광고를 게재하지 않습니다(
          <a href="/principles" className="underline underline-offset-2">
            편집 원칙
          </a>
          의 공개 선언). 향후 정책이 변경될 경우 제10조의 절차에 따라 시행 7일 전
          공지합니다.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제8조 (금지 행위)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>서비스를 영리 목적으로 무단 복제·재배포하는 행위</li>
          <li>크롤러·자동화 도구로 대량 요청을 발생시키는 행위</li>
          <li>스탬프 등 참여 집계를 왜곡하는 행위</li>
          <li>서비스의 정상 운영을 방해하는 일체의 행위</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제9조 (정정 요청)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            지면 내용이 사실과 다르다고 판단되는 경우 누구든지 아래 문의 이메일로
            정정을 요청할 수 있습니다(지면 하단 &ldquo;정정 요청&rdquo; 링크).
          </li>
          <li>
            운영자는 요청을 확인한 뒤 원본 데이터 대조를 거쳐 오류가 확인되면
            지체 없이 정정하고, 요청인에게 처리 결과를 회신합니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제10조 (약관의 변경)</h2>
        <p>
          본 약관은 관련 법령 또는 서비스 정책 변경에 따라 개정될 수 있으며, 개정
          시 사이트 내 공지를 통해 시행 7일 전 안내합니다.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">제11조 (준거법 및 관할)</h2>
        <p>
          본 약관은 대한민국 법령에 따라 해석·적용되며, 서비스 이용과 관련한 분쟁은
          민사소송법상 관할법원을 따릅니다.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">부칙</h2>
        <p>
          본 약관은 {REVISION_EFFECTIVE_DATE}부터 시행합니다. 종전 약관(
          {SERVICE_START_DATE} 시행)은 그 전날까지 적용됩니다.
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
    </>
  );
}

/** 종전 약관 전문 (2026-05-15 시행 — 개정 시행일 전까지 본문으로 게시). */
function OriginalTerms() {
  return (
    <>
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
            화면에 표시되는 <strong>추정 시세</strong>는 공개 실거래가를 가공한
            통계적 추정치로서 「감정평가 및 감정평가사에 관한 법률」상 감정평가액이
            아니며, 감정평가·담보 설정 등 금융거래의 기초자료로 사용할 수 없습니다.
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
    </>
  );
}

export default function TermsPage() {
  if (revisionInEffect) {
    return (
      <LegalPage title="이용약관" effectiveDate={REVISION_EFFECTIVE_DATE}>
        <RevisedTerms />
      </LegalPage>
    );
  }
  // 시행일 전 — 현행 약관을 본문으로, 개정 공지 + 개정 전문(접힘)을 상단에 게시(제8조 절차).
  return (
    <LegalPage title="이용약관" effectiveDate={SERVICE_START_DATE}>
      <section className="rounded border border-amber-300 bg-amber-50 p-4">
        <h2 className="mb-2 text-lg font-semibold">
          약관 개정 공지 ({REVISION_NOTICE_DATE})
        </h2>
        <p className="mb-2">
          {REVISION_EFFECTIVE_DATE}부터 개정 약관이 시행됩니다. 주요 변경:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>서비스 범위 현행화 — 일간 지면(1면·동네판·동네면) 발행 반영</li>
          <li>지면은 언론매체가 아닌 데이터 자동 발행 서비스임을 명시</li>
          <li>독자 참여(거래 스탬프) 조항 신설 — 평가의 성격·집계 왜곡 금지</li>
          <li>광고 조항 정비 — 광고를 게재하지 않음(편집 원칙 공개 선언과 일치)</li>
          <li>정정 요청 절차 신설</li>
        </ul>
        <details className="mt-3">
          <summary className="cursor-pointer font-semibold">개정 약관 전문 보기</summary>
          <div className="mt-3 space-y-6">
            <RevisedTerms />
          </div>
        </details>
      </section>
      <OriginalTerms />
    </LegalPage>
  );
}
