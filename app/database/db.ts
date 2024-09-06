import { MongoClient } from "mongodb";

import { env } from "./env.ts";

export const client = new MongoClient(env.MONGO_DB_URL);
export async function connect() {
  client.on("connectionReady", () => {
    console.log("MongoDB connectionReady");
  });
  client.on("connectionClosed", () => {
    console.log("MongoDB connectionClosed");
  });
  return await client.connect();
}
export const OFFCHAIN_DB_NAME = "offchain";

// Track where the indexer is
export const cursor_collection = client
  .db(OFFCHAIN_DB_NAME)
  .collection("cursor");
// Keep a local copy of the pertinent blocks
export const blocks_collection = client
  .db(OFFCHAIN_DB_NAME)
  .collection("blocks");
