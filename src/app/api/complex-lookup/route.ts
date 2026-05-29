import { searchComplexesByName } from "@/lib/recommend/snapshot";

// 역방향 진입(#4) — 단지명 단답 검색. 스냅샷만 읽어 DB 0(geocode route와 같은 결).
export async function GET(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    return Response.json({ results: searchComplexesByName(q) });
  } catch {
    return Response.json({ results: [] });
  }
}
