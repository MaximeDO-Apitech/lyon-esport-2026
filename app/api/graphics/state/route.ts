import { getGraphicsStateEnvelope } from "../../../../lib/graphics/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const envelope = await getGraphicsStateEnvelope();
    return Response.json(envelope, {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate",
        "x-les-state-revision": String(envelope.state.revision),
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "État graphique indisponible." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
