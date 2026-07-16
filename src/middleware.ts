import { NextResponse, type NextRequest } from "next/server";

// ── 전체 사이트 일시 점검(서비스 중단) ────────────────────────────────────────
// 2026-07-16 사장 지시 — 부동산 규제 리스크 대응으로 전 페이지를 잠시 내려둔다.
// 되돌리기(재개): 아래 MAINTENANCE_ON 을 false 로 바꾸고 재배포하면 즉시 정상 복구.
//   (급하면 Vercel 환경변수 MAINTENANCE_OVERRIDE=off 로도 코드 수정 없이 해제 가능.)
// 데이터·코드·크론(매일 수집)은 그대로 보존 — 재개 시 최신 데이터로 바로 돌아온다.
//
// 동작: 켜져 있으면 모든 경로(정적 자산 제외)에 503(점검) HTML 을 돌려준다.
//   503 + Retry-After 로 검색엔진 색인 유지(임시 중단 신호), no-store 로 캐시 방지.
const MAINTENANCE_ON = true;

function maintenanceEnabled(): boolean {
  if (process.env.MAINTENANCE_OVERRIDE === "off") return false; // 즉시 해제 탈출구
  return MAINTENANCE_ON;
}

const MAINTENANCE_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>비집고 — 일시 점검 중</title>
<style>
  :root { color-scheme: light; }
  html,body { margin:0; height:100%; }
  body {
    background:#fbfaf6; color:#191713;
    font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", sans-serif;
    display:flex; align-items:center; justify-content:center; padding:24px;
  }
  .card { width:100%; max-width:420px; text-align:left; }
  .plate {
    display:inline-block; background:#e8571f; color:#fbfaf6;
    font-weight:800; letter-spacing:0.06em; font-size:15px;
    padding:4px 10px; line-height:1;
  }
  h1 { font-size:24px; font-weight:800; margin:22px 0 10px; letter-spacing:-0.01em; }
  p { font-size:14px; line-height:1.7; color:#5d574c; margin:0 0 8px; }
  .rule { height:2px; background:#191713; margin:20px 0 16px; }
  a { color:#191713; }
  .meta { margin-top:18px; font-size:12px; color:#8a857a; }
</style>
</head>
<body>
  <div class="card">
    <span class="plate">비집고</span>
    <h1>잠시 점검 중입니다</h1>
    <div class="rule"></div>
    <p>서비스를 일시적으로 멈춰두었습니다. 준비가 되는 대로 다시 찾아뵙겠습니다.</p>
    <p>이용에 불편을 드려 죄송합니다.</p>
    <p class="meta">문의: <a href="mailto:support@bijigo.kr">support@bijigo.kr</a></p>
  </div>
</body>
</html>`;

export function middleware(_req: NextRequest) {
  if (!maintenanceEnabled()) return NextResponse.next();
  return new NextResponse(MAINTENANCE_HTML, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "retry-after": "3600",
      "cache-control": "no-store, must-revalidate",
    },
  });
}

// 정적 자산(_next)만 통과 — 그 외 모든 경로(홈·판독·API·지도·공유카드)는 점검 페이지로.
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
