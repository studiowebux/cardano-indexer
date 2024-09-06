import Logger from "@studiowebux/deno-minilog";

import { LocalBlock } from "../../../src/shared/types.ts";

// Application Specific
// Linked with the database lib.
import { upsert_block } from "../../database/queries.ts";

export async function handle_block(logger: Logger, data: LocalBlock | null) {
  if (!data) {
    return;
  }
  await upsert_block(data);
  logger.info("Block added !");
}
