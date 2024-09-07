import type { Collection, Document, Filter } from "mongodb";
import type Logger from "@studiowebux/deno-minilog";

import type { Cursor, LocalBlock } from "../../src/shared/types.ts";
import { cursor_collection, blocks_collection } from "./db.ts";

export async function upsert_cursor(logger: Logger, cursor: Cursor | "origin") {
  if (typeof cursor === "string" && cursor === "origin") {
    await delete_all_documents(logger, cursor_collection);
    return;
  }
  const query = { id: "cursor" };
  const update = {
    $set: {
      cursor_id: cursor.id,
      slot: cursor.slot,
      last_updated_at: new Date(),
    },
  };
  const options = { upsert: true };
  return cursor_collection.updateOne(query, update, options);
}

export function upsert_block(block: LocalBlock) {
  const query = { id: block.id };
  const update = {
    $set: {
      ...block,
      last_updated_at: new Date(),
    },
  };
  const options = { upsert: true };
  return blocks_collection.updateOne(query, update, options);
}

async function delete_all_documents(
  logger: Logger,
  collection: Collection<Document>,
) {
  try {
    const result = await collection.deleteMany({});
    logger.info(
      `Deleted ${result.deletedCount} documents (${collection.collectionName}/${collection.dbName}).`,
    );
  } catch (error) {
    logger.error("Error deleting documents:", error);
  }
}

export async function rollback_blocks(
  logger: Logger,
  collection: Collection<Document>,
  value: string | number,
) {
  if (typeof value === "string" && value === "origin") {
    await delete_all_documents(logger, collection);
    return;
  }
  const slot: number = +value;

  const filter: Filter<Document & { block_slot?: number; slot?: number }> = {
    $or: [{ block_slot: { $gte: slot } }, { slot: { $gte: slot } }],
  };

  try {
    const results = await collection.find(filter).toArray();
    if (results.length > 0) {
      logger.info(`Found ${results.length} documents matching the filter:`);

      await collection.deleteMany(filter);
      logger.info(
        `Deleted ${results.length} documents (${collection.collectionName}/${collection.dbName}).`,
      );
    } else {
      logger.info(
        `No documents found (${collection.collectionName}/${collection.dbName}).`,
      );
    }
  } catch (error) {
    logger.error("Error executing query:", error);
    throw new Error(error);
  }
}

export async function get_cursor(): Promise<{
  id: string;
  cursor_id: string;
  last_updated_at: string;
  slot: number;
}> {
  const result = await cursor_collection.findOne({ id: "cursor" });
  return result;
}
