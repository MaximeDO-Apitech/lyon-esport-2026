import { env } from "cloudflare:workers";
import { GraphicsCommandError } from "./types";

type RuntimeEnv = {
  LES_ADMIN_TOKEN?: string;
};

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

export function assertCommandAuthorized(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) {
    throw new GraphicsCommandError("Origine de commande refusée.", 403, "origin_forbidden");
  }

  const runtimeEnv = env as unknown as RuntimeEnv;
  const configuredToken = runtimeEnv.LES_ADMIN_TOKEN?.trim();
  if (configuredToken) {
    const authorization = request.headers.get("authorization") ?? "";
    if (authorization !== `Bearer ${configuredToken}`) {
      throw new GraphicsCommandError("Jeton de commande invalide.", 401, "unauthorized");
    }
    return;
  }

  if (isLoopback(url.hostname)) return;
  if (request.headers.get("oai-authenticated-user-id")) return;

  throw new GraphicsCommandError(
    "Les commandes distantes sont désactivées. Configure LES_ADMIN_TOKEN pour une régie LAN.",
    403,
    "remote_commands_disabled",
  );
}
