import Logger from "@studiowebux/deno-minilog";

// Application Specific
// Linked with the database lib.
import { rollback_blocks } from "../../database/queries.ts";
import { ProcessorInput } from "../../../src/shared/types.ts";
import { blocks_collection } from "../../database/db.ts";

export async function handle_rollback(logger: Logger, data: ProcessorInput) {
  if (!data.rollback) {
    return;
  }
  const tip: string =
    data.rollback !== "origin" ? data.rollback.slot.toString() : data.rollback;

  // Delete Blocks
  await rollback_blocks(logger, blocks_collection, tip);
}
