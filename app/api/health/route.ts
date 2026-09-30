import { checkStoreHealth } from "../../../lib/graphics/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const storage = await checkStoreHealth();
    return Response.json(
      {
        ok: true,
        service: "LES Graphics Studio",
        serverTimeUtc: new Date().toISOString(),
        ...storage,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Erreur de stockage." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
