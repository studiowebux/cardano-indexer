import { Hono, type Context } from "hono";
import { logger as hono_logger } from "hono/logger";

import Logger from "@studiowebux/deno-minilog";

import { hrtime } from "node:process";

import { BLOCK_TOPIC } from "../../src/shared/constant.ts";
import { kafkaConsumer } from "../../src/shared/kafka/index.ts";
import { processMessage } from "./processor.ts";
import { exponentialRetry } from "../../src/shared/utils/retry.ts";
import {
  consumer_counter,
  consumer_histogram,
  prom_client,
} from "../../src/shared/prometheus/processor.ts";
import type { Status } from "../../src/shared/types.ts";

const app = new Hono();

app.use(hono_logger());

const logger = new Logger();

const consumer = kafkaConsumer.consumer({ groupId: "indexer" });

await consumer.connect();
await consumer.subscribe({ topic: BLOCK_TOPIC, fromBeginning: true });

const status: Status = {
  started_at: undefined,
  stopped_at: undefined,
  state: "INACTIVE",
};

app.get("/metrics", async (c: Context) => {
  return c.text(await prom_client.register.metrics());
});

app.get("/status", (c: Context) => {
  return c.json(status);
});

app.post("/stop", async (c: Context) => {
  await consumer.stop();
  status.state = "INACTIVE";
  status.started_at = undefined;
  status.stopped_at = new Date();
  return c.json(status);
});

app.post("/start", async (c: Context) => {
  status.state = "ACTIVE";
  status.started_at = new Date();
  status.stopped_at = undefined;
  await consumer.run({
    // topic, partition, heartbeat
    eachMessage: async ({ message, pause }) => {
      const start = hrtime();
      const key = message.key?.toString();
      const value = message.value?.toString();
      logger.info(`Received message: ${key} - ${value?.length}`);

      try {
        await exponentialRetry<void>(() => processMessage(logger, key, value));
      } catch (e) {
        logger.error("Something went wrong", e);
        pause();
      } finally {
        const end = hrtime(start);
        consumer_counter.inc({ task: "store" });
        consumer_histogram.observe(
          { task: "store" },
          end[0] + end[1] / Math.pow(10, 9),
        );
      }
    },
  });
  return c.json(status);
});

Deno.serve({ port: 3020 }, app.fetch);

Deno.addSignalListener("SIGINT", async () => {
  logger.warn("SIGINT!");
  await consumer.stop();
  status.state = "INACTIVE";
  status.started_at = undefined;
  status.stopped_at = new Date();
  logger.info("Get Status", status);
  Deno.exit(0);
});
