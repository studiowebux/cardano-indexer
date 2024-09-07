import { createInteractionContext } from "@cardano-ogmios/client";
import type Logger from "@studiowebux/deno-minilog";

import type { Indexer } from "../indexer/index.ts";
import { env } from "../../shared/env.ts";

export const context = async (logger: Logger, indexer?: Indexer) =>
  await createInteractionContext(
    (err: unknown) => {
      logger.error("Ogmios has crashed.");
      logger.error(err);
      indexer?.Stop();
    },
    () => {
      logger.warn("Ogmios Connection Closed.");
      indexer?.Stop();
    },
    {
      connection: {
        host: env.OGMIOS_HOST,
        port: parseInt(env.OGMIOS_PORT),
      },
    },
  );
