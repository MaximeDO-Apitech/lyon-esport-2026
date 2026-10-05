import { getOperationsStatus } from "../../../lib/operations/status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getOperationsStatus();
    return Response.json(status, {
      headers: { "cache-control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Statut de régie indisponible.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
