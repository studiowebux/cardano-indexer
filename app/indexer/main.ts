import { Hono, type Context } from "hono";
import { logger as hono_logger } from "hono/logger";
import { cors } from "hono/cors";
import PromClient from "prom-client";
import Logger from "@studiowebux/deno-minilog";

import { Hooks } from "../../src/core/hook/index.ts";
import { WalletAddress } from "../../src/core/filters/wallet_address.ts";
import { Indexer } from "../../src/core/indexer/index.ts";
import { get_cursor, upsert_cursor } from "../database/queries.ts";

const app = new Hono();

app.use("/*", cors());
app.use("/api/*", hono_logger());

const logger = new Logger();
const hooks = new Hooks(logger);
const prom_client: typeof PromClient = PromClient;

hooks.Enable(
  new WalletAddress(
    "wallet_address_1",
    logger,
    "addr1q8k3eglk7txg02ax9nuds8t399pd5vjn6cmk9drlq6reger80c088xejdvajl9fh5va2pzwqknpkrllgf3n4whup8lts2fds3w",
    prom_client,
  ),
);

// Get last saved cursor and start from there
let start:
  | {
      id: string;
      cursor_id: string;
      last_updated_at: string;
      slot: number;
    }
  | string = await get_cursor();

if (!start) {
  // Put the initial start state of the indexer.
  start = "origin";
}

const indexer = new Indexer(
  hooks,
  logger,
  typeof start === "string"
    ? [start]
    : [{ id: start.cursor_id, slot: start.slot }],
  6,
  upsert_cursor,
  60 * 1000 * 15, // every 15 minutes snapshot the cursor in case it crashes, it will start from the cursor.
  prom_client,
);

await indexer.Initialize();
await indexer.ConnectAndStart();

app.get("/metrics", async (c: Context) => {
  return c.text(await indexer.GetMetrics());
});

app.get("/api/health", async (c: Context) => {
  return c.json(await indexer.GetOgmiosServerHealth());
});

app.get("/api/status", (c: Context) => {
  return c.json(indexer.GetStatus());
});

app.post("/api/stop", async (c: Context) => {
  await indexer.Stop();
  return c.json(indexer.GetStatus());
});

app.post("/api/start", async (c: Context) => {
  await indexer.Initialize();
  await indexer.ConnectAndStart();
  return c.json(indexer.GetStatus());
});

app.post("/api/snapshot", async (c: Context) => {
  await indexer.SaveCursor();
  return c.json(indexer.GetCurrentIntersection());
});

app.get("/api/cursor", (c: Context) => {
  return c.json(indexer.GetCurrentIntersection());
});

Deno.serve({ port: 3310 }, app.fetch);

Deno.addSignalListener("SIGINT", async () => {
  logger.warn("SIGINT!");
  logger.info("Ogmios Server Info", await indexer.GetOgmiosServerHealth());
  await indexer.Stop();
  logger.info("Get Status", indexer.GetStatus());
  logger.info("Current Intersection", indexer.GetCurrentIntersection());
  Deno.exit(0);
});
