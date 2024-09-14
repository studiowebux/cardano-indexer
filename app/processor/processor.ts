import type Logger from "@studiowebux/deno-minilog";

// Handlers
import { handle_block } from "./handlers/block.ts";
import { handle_rollback } from "./handlers/rollback.ts";
import type { ProcessorInput } from "../../src/shared/types.ts";

export async function processMessage(
  logger: Logger,
  key: string | undefined,
  value: string | undefined,
) {
  logger.info(`Processing: ${key}`);

  if (!value) {
    throw new Error("Value is empty, this is not expected.");
  }
  const parsed: ProcessorInput = JSON.parse(value);

  await handle_rollback(logger, parsed);
  await handle_block(logger, parsed.block);
}
