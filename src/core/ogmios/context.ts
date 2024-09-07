import { createInteractionContext } from "@cardano-ogmios/client";
import type Logger from "@studiowebux/deno-minilog";

import { env } from "../../shared/env.ts";

export const context = async (logger: Logger) =>
  await createInteractionContext(
    (err: unknown) => logger.error(err),
    () => logger.warn("Ogmios Connection Closed."),
    {
      connection: {
        host: env.OGMIOS_HOST,
        port: parseInt(env.OGMIOS_PORT),
      },
    },
  );
