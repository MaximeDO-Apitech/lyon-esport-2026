import { getReplayStateEnvelope } from "../../../../lib/replay/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const envelope = await getReplayStateEnvelope();
    return Response.json(envelope, {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate",
        "x-les-replay-state-revision": String(envelope.state.revision),
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "État replay indisponible." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
