import { acknowledgeRenderer } from "../../../../lib/graphics/store";
import { GraphicsCommandError, type OutputId } from "../../../../lib/graphics/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      rendererId?: string;
      output?: OutputId;
      revision?: number;
    };
    if (!payload.rendererId || (payload.output !== "attente" && payload.output !== "synthe")) {
      throw new GraphicsCommandError("Accusé de rendu invalide.");
    }
    await acknowledgeRenderer({
      rendererId: payload.rendererId,
      output: payload.output,
      revision: Number(payload.revision),
      appliedAtUtc: new Date().toISOString(),
    });
    return Response.json({ accepted: true }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof GraphicsCommandError ? error.status : 500;
    return Response.json(
      { accepted: false, error: error instanceof Error ? error.message : "Accusé refusé." },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}
