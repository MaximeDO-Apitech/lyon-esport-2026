import { assertCommandAuthorized } from "../../../../lib/graphics/auth";
import { executeGraphicsCommand } from "../../../../lib/graphics/store";
import { GraphicsCommandError, type GraphicsCommand } from "../../../../lib/graphics/types";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof GraphicsCommandError) {
    return Response.json(
      { accepted: false, code: error.code, error: error.message },
      { status: error.status, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { accepted: false, code: "internal_error", error: error instanceof Error ? error.message : "Commande refusée." },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    assertCommandAuthorized(request);
    const payload = (await request.json()) as Partial<GraphicsCommand>;
    if (typeof payload !== "object" || typeof payload.id !== "string" || typeof payload.type !== "string") {
      throw new GraphicsCommandError("Corps de commande invalide.", 400, "invalid_payload");
    }
    const result = await executeGraphicsCommand(payload as GraphicsCommand);
    return Response.json(result, {
      status: result.duplicate ? 200 : 202,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
