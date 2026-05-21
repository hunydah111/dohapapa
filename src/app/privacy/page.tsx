import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, SERVICE_START_DATE, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `개인정보처리방침 — ${SITE_NAME}`,
  description: `${SITE_NAME}의 개인정보 수집·이용에 관한 안내`,
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" effectiveDate={SERVICE_START_DATE}>
      <section>
        <h2 className="mb-2 text-lg font-semibold">1. 수집하는 개인정보 항목</h2>
        <p>
          {SITE_NAME}은(는) 회원가입 없이 익명으로 이용할 수 있으며, 다음 정보를
          처리합니다.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>사용자 입력 정보 (서버 저장 안 함):</strong> 부부 직장
            소재지·소득·자녀 유무·예산 등 조건 추천을 위해 입력하는 값. 추천
            결과 생성에만 사용되며 서버에 영구 저장하지 않습니다.
          </li>
          <li>
            <strong>자동 수집 정보:</strong> 접속 IP, 브라우저 종류, 방문 페이지,
            방문 일시 (서비스 운영 및 통계 목적).
          </li>
          <li>
            <strong>쿠키:</strong> 방문자 통계, 광고 제공을 위한 쿠키 (Google
            AdSense, Google Analytics 등).
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">2. 개인정보의 이용 목적</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>아파트 단지 추천 결과 생성</li>
          <li>서비스 이용 통계 분석 및 품질 개선</li>
          <li>광고 노출 및 광고 효과 측정</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">3. 개인정보의 보유 및 이용기간</h2>
        <p>
          사용자가 입력한 부부 프로필·조건 정보는 페이지를 떠나는 순간 소멸되며
          서버에 저장되지 않습니다. 자동 수집 정보 및 분석용 쿠키는 통계
          목적으로 최대 1년간 보관 후 파기됩니다.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">4. 광고 및 쿠키 사용</h2>
        <p>
          본 사이트는 Google AdSense를 통해 광고를 노출할 수 있습니다. Google을
          비롯한 제3자 공급업체는 쿠키를 사용하여 사용자의 본 사이트 및 기타
          사이트 방문 기록을 기반으로 광고를 게재합니다. 사용자는{" "}
          <a
            href="https://adssettings.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-coral-600 underline"
          >
            Google 광고 설정
          </a>
          에서 맞춤 광고를 비활성화할 수 있습니다.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">5. 제3자 제공</h2>
        <p>
          원칙적으로 사용자 정보를 외부에 제공하지 않습니다. 단, 다음의 경우는
          예외입니다.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>사용자가 사전에 동의한 경우</li>
          <li>
            법령에 의거하거나 수사기관의 적법한 요청이 있는 경우
          </li>
        </ul>
        <p className="mt-2">
          위 항목과 별개로, 통근 시간 계산·위치 검색 등 서비스 제공에 필요한
          외부 API로의 일시적 데이터 전송은 제6조에 따릅니다.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">6. 외부 API 데이터 사용</h2>
        <p>
          본 서비스는 다음의 공공·외부 API를 활용합니다. 사용자 입력값(직장
          주소·좌표 등)은 통근 시간 계산 및 단지 위치 표시를 위해 해당 API에
          일시적으로 전송됩니다. 특히 <strong>대중교통 통근 시간은 이용자
          브라우저에서 ODsay 길찾기 API를 직접 호출</strong>하며, 이 과정에서
          직장·단지 좌표와 접속 IP가 ODsay에 전달됩니다. 각 사업자의 개인정보
          처리는 해당 사업자의 정책을 따릅니다.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>국토교통부 실거래가 공개 API (단지·거래 데이터)</li>
          <li>카카오 지도/내비 API (위치 검색·자동차 경로 안내)</li>
          <li>네이버 검색 API (직장명·장소 검색 보조)</li>
          <li>
            ODsay 대중교통 길찾기 API (대중교통 경로·소요시간 — 이용자
            브라우저에서 직접 호출)
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">7. 이용자의 권리</h2>
        <p>
          이용자는 언제든지 본인의 정보 입력을 중단하거나 브라우저 쿠키를
          삭제·차단할 수 있습니다. 별도의 회원가입이 없으므로 탈퇴·삭제 요청
          절차는 두지 않습니다.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">8. 개인정보 보호 책임자</h2>
        <p>
          개인정보 관련 문의는 아래로 연락주시기 바랍니다.
          <br />
          이메일: <a href={`mailto:${CONTACT_EMAIL}`} className="text-coral-600 underline">{CONTACT_EMAIL}</a>
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">9. 고지 의무</h2>
        <p>
          본 방침은 시행일을 기준으로 적용되며, 내용 추가·삭제·수정 시 사이트
          내 공지를 통해 안내합니다.
        </p>
      </section>
    </LegalPage>
  );
}
