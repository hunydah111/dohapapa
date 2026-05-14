import { searchPlaces } from "@/lib/geocode";

export async function GET(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    const results = await searchPlaces(q);
    return Response.json({ results });
  } catch {
    // Never break the form — surface an empty result set on unexpected errors
    return Response.json({ results: [] });
  }
}
