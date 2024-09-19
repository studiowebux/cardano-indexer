import { Hono, type Context } from "hono";
import { logger as hono_logger } from "hono/logger";
import { cors } from "hono/cors";
import Logger from "@studiowebux/deno-minilog";

import { Hooks } from "../../src/core/hook/index.ts";
import { WalletAddress } from "../../src/core/filters/wallet_address.ts";
import { Indexer } from "../../src/core/indexer/index.ts";
import { get_cursor, upsert_cursor } from "../database/queries.ts";
import { prom_client_indexer } from "../../src/shared/prometheus/indexer.ts";

const app = new Hono();

const logger = new Logger();
const hooks = new Hooks(logger);

app.use("/*", cors());
app.use("/api/*", hono_logger());

hooks.Enable(
  new WalletAddress(
    "wallets",
    logger,
    [
      "addr1q8k3eglk7txg02ax9nuds8t399pd5vjn6cmk9drlq6reger80c088xejdvajl9fh5va2pzwqknpkrllgf3n4whup8lts2fds3w",
      "addr1q9qur503rgx3duk9k5law0z09d9gq3mgt948cgmx8cv77ymlfwslu37u86tjlrljy9w60cf2c3dgh7pplmzg7f8zd35s9m3r5u",
      "addr1qxf0w39qyuuyz2a5pukw8yj8yrwfceet59vsu3l5kk5kh8ml09mmle9rgt0ljcns8ydlwshk6ce4l0zwq9k9dx7g29pst6xcjj",
      "addr1zxghhvqaa70gt7wvlwte8guvrffzd5h7sy8yh7dghcky0ttl09mmle9rgt0ljcns8ydlwshk6ce4l0zwq9k9dx7g29ps0c9zel",
      "addr1qxfj8wk8k203pqeg3pghesm3yaqejeatum97htlc0njzul0nddzx2usmswe8wzylsn9xsxar5pk8tgmtzqt7n9zz8wzqwhtvpd",
    ],
    prom_client_indexer,
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
    : [{ id: start.cursor_id, slot: start.slot, height: 0 }], // Height is unknown at this point and not required.
  6,
  upsert_cursor,
  60 * 1000 * 5, // every 5 minutes snapshot the cursor in case it crashes, it will start from the cursor.
  prom_client_indexer,
);

await indexer.Initialize();
await indexer.ConnectAndStart();

app.get("/metrics", async (c: Context) => {
  return c.text(await indexer.GetMetrics());
});

app.get("/api/health", async (c: Context) => {
  return c.json(await indexer.GetOgmiosServerHealth());
});

app.get("/api/sysinfo", (c: Context) => {
  return c.json({
    load_avg: Deno.loadavg(),
    memory_usage: Deno.memoryUsage(),
    memory_info: Deno.systemMemoryInfo(),
  });
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

app.get("/api/socket/status", (c: Context) => {
  return c.json(indexer.GetSocketState());
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
