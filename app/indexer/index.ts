import Logger from "@studiowebux/deno-minilog";

import { Hooks } from "../../src/core/hook/index.ts";
import { WalletAddress } from "../../src/core/filters/wallet_address.ts";
import { Indexer } from "../../src/core/indexer/index.ts";

// Application Specific
// Linked with the database lib.
import { get_cursor, upsert_cursor } from "../database/queries.ts";

// USAGE

const logger = new Logger();
const hooks = new Hooks(logger);
hooks.Enable(
  new WalletAddress(
    "addr-address",
    logger,
    "addr1q8k3eglk7txg02ax9nuds8t399pd5vjn6cmk9drlq6reger80c088xejdvajl9fh5va2pzwqknpkrllgf3n4whup8lts2fds3w",
  ),
);

// const start = [
//   {
//     slot: 84335007,
//     id: "180a1ef2ccf3e86d5fae1701e5654ed219b0f46441880adef92b5377831a330a",
//   },
// ]

// const start = ["origin"]

const start = await get_cursor();

const indexer = new Indexer(
  hooks,
  logger,
  [{ id: start.cursor_id, slot: start.slot }],
  6,
  upsert_cursor,
  60 * 1000 * 15, // every 15 minutes snapshot the cursor in case it crashes, it will start from the cursor.
);

await indexer.Initialize();
await indexer.ConnectAndStart();

logger.info(await indexer.GetOgmiosServerHealth());

setInterval(async () => {
  logger.info(await indexer.GetMetrics());
}, 30000);

// await indexer.GetOgmiosServerHealth();

Deno.addSignalListener("SIGINT", async () => {
  logger.warn("SIGINT!");
  logger.info("Ogmios Server Info", await indexer.GetOgmiosServerHealth());
  await indexer.Stop();
  logger.info("Get Status", indexer.GetStatus());
  logger.info("Current Intersection", indexer.GetCurrentIntersection());
  Deno.exit(0);
});
