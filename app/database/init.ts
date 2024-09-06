import { MongoClient } from "mongodb";

import { env } from "./env.ts";
import { blocks_collection } from "./db.ts";

const client = new MongoClient(env.MONGO_DB_URL);

/**
 * Setup mongoDb indexes for webux indexer
 */
export async function setup_indexes() {
  await client.connect();
  console.log("Connected successfully to server");

  const block = await blocks_collection.createIndex(
    { slot: 1, id: 1, height: 1 },
    { unique: true },
  );
  console.log(block);

  client.close();

  console.log("Indexes setup");
}

await setup_indexes();
Deno.exit(0);
