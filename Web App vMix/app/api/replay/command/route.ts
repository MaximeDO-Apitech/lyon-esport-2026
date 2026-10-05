import { assertCommandAuthorized } from "../../../../lib/graphics/auth";
import { executeReplayCommand } from "../../../../lib/replay/store";
import { ReplayCommandError, type ReplayCommand } from "../../../../lib/replay/types";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof ReplayCommandError) {
    return Response.json(
      { accepted: false, code: error.code, error: error.message },
      { status: error.status, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { accepted: false, code: "internal_error", error: error instanceof Error ? error.message : "Commande replay refusée." },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    assertCommandAuthorized(request);
    const payload = (await request.json()) as Partial<ReplayCommand>;
    if (typeof payload !== "object" || typeof payload.id !== "string" || typeof payload.type !== "string") {
      throw new ReplayCommandError("Corps de commande replay invalide.", 400, "invalid_replay_payload");
    }
    const result = await executeReplayCommand(payload as ReplayCommand);
    return Response.json(result, {
      status: result.duplicate ? 200 : 202,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
